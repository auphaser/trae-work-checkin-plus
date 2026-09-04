#!/usr/bin/env node
/**
 * Trae 本地账号鉴权共用模块（只读）
 *
 * 负责：定位本地登录态 → 解密「tc 格式」→ 令牌临期自动刷新 → 带鉴权头发起请求。
 * 安全约定：令牌仅在内存/闭包中，本模块不打印令牌，也不把令牌写盘。
 * 端点与加解密方法逆向自官方客户端，可能随版本变化。
 */
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function storageCandidates() {
  const home = os.homedir();
  const roots = [
    path.join(home, "Library", "Application Support"),
    process.env.APPDATA || path.join(home, "AppData", "Roaming"),
  ];
  const names = ["Trae CN", "TRAE SOLO CN", "Trae", "TRAE SOLO"];
  const out = [];
  for (const root of roots) for (const n of names) out.push(path.join(root, n, "User", "globalStorage", "storage.json"));
  return out;
}

const SALT_A = Uint8Array.from([82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37]);
const SALT_B = Uint8Array.from([31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125]);
function xor(a, b, n) { const r = new Uint8Array(n); for (let i = 0; i < n; i++) r[i] = a[i] ^ b[i]; return r; }

function decryptAuthValue(b64) {
  const buf = Buffer.from(b64, "base64");
  const hd = buf.slice(0, 6), rb = buf.slice(6, 38), enc = buf.slice(38);
  if (!(hd[0] === 0x74 && hd[1] === 0x63 && hd[2] === 0x05 && hd[3] === 0x10 && hd[4] === 0 && hd[5] === 0)) {
    throw new Error("未知的登录态加密格式（header 不匹配）");
  }
  const salt = xor(SALT_A, SALT_B, 64);
  const finalHash = crypto.createHash("sha512")
    .update(Buffer.concat([crypto.createHash("sha512").update(rb).digest(), Buffer.from(salt)]))
    .digest();
  const dc = crypto.createDecipheriv("aes-128-cbc", finalHash.slice(0, 16), finalHash.slice(16, 32));
  const plain = Buffer.concat([dc.update(enc), dc.final()]);
  const stored = plain.slice(0, 64);
  const payload = plain.slice(64);
  const computed = crypto.createHash("sha512").update(payload).digest();
  if (!stored.equals(computed)) throw new Error("解密校验失败（SHA-512 不符）");
  return JSON.parse(payload.toString("utf8"));
}

function loadAuth() {
  for (const p of storageCandidates()) {
    if (!fs.existsSync(p)) continue;
    const storage = JSON.parse(fs.readFileSync(p, "utf8"));
    const enc = storage["iCubeAuthInfo://icube.cloudide"];
    if (!enc) continue;
    if (String(enc).trim().startsWith("{")) return JSON.parse(enc); // 国际版明文
    return decryptAuthValue(String(enc));
  }
  throw new Error("未找到 Trae 本地登录态（storage.json）。请先安装并登录 Trae/TraeWork 桌面端。");
}

function devId() {
  return crypto.createHash("sha256").update(crypto.randomBytes(32).toString("hex")).digest("hex").substring(0, 32);
}
function buildHeaders(token, uid) {
  return {
    "Authorization": `Cloud-IDE-JWT ${token}`,
    "X-Cloudide-Token": token,
    "x-uid": String(uid),
    "x-app-id": "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
    "x-device-id": devId(),
    "x-machine-id": crypto.randomBytes(32).toString("hex"),
    "x-request-id": crypto.randomUUID(),
    "x-ide-version": "3.3.67",
    "x-ide-version-code": "20260401",
    "x-device-type": "windows",
    "x-os-version": "Windows 10",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/**
 * 返回一个带令牌的客户端：
 *   client.lib  -> 登录态原文（含 userId / host / refreshToken，供需要时判断）
 *   client.post(path, body) -> 自动刷新令牌后 POST 并返回 { status, json }
 */
async function createClient() {
  const auth = loadAuth();
  const host = auth.host || "https://api.trae.cn";
  const uid = String(auth.userId || "");
  let token = auth.token;
  let refreshing = null;

  async function refresh() {
    if (!auth.refreshToken) return false;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const r = await fetch(`${host}/cloudide/api/v3/trae/oauth/ExchangeToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ClientID: "ono9krqynydwx5",
          RefreshToken: auth.refreshToken,
          ClientSecret: "-",
          UserID: uid,
        }),
      });
      const j = await r.json();
      if (j && j.Result && j.Result.Token) { token = j.Result.Token; return true; }
      return false;
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }

  // 访问令牌临近过期则先行刷新（避免并行请求各自 401 互相踩掉旧令牌）
  if (!auth.expiredAt || (new Date(auth.expiredAt).getTime() - Date.now()) < 30 * 60 * 1000) {
    await refresh();
  }

  return {
    lib: auth,
    host,
    userId: uid,
    async post(p, body) {
      const doFetch = () =>
        fetch(`${host}${p}`, { method: "POST", headers: buildHeaders(token, uid), body: JSON.stringify(body) });
      let resp = await doFetch();
      if (resp.status === 401) { await refresh(); resp = await doFetch(); }
      return resp.json().then((j) => ({ status: resp.status, json: j })).catch(() => ({ status: resp.status, json: {} }));
    },
  };
}

module.exports = { loadAuth, createClient, buildHeaders, decryptAuthValue };