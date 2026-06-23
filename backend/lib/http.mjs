// Minimal cookie-jar HTTP client tuned for ASP.NET WebForms portals.
// Keeps a session cookie jar, extracts hidden fields (__VIEWSTATE etc.), and
// resubmits them on POST so we can drive postback search forms without a browser.
import * as cheerio from "cheerio";

export class Session {
  constructor(opts = {}) {
    this.jar = new Map();                 // name -> value
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(opts.headers || {}),
    };
    this.timeout = opts.timeout || 25000;
  }

  cookieHeader() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  _absorb(res) {
    // node fetch exposes combined set-cookie via getSetCookie() (Node 18.14+)
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of cookies) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  async _fetch(url, init = {}, attempt = 0) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        redirect: "manual",
        ...init,
        headers: { ...this.headers, ...(init.headers || {}),
          ...(this.jar.size ? { Cookie: this.cookieHeader() } : {}) },
        signal: ctrl.signal,
      });
      this._absorb(res);
      // follow redirects manually so cookies/relative Location are handled
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (loc) {
          const next = new URL(loc, url).toString();
          const method = res.status === 307 || res.status === 308 ? (init.method || "GET") : "GET";
          return this._fetch(next, { method, body: method === "GET" ? undefined : init.body });
        }
      }
      return res;
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); return this._fetch(url, init, attempt + 1); }
      throw e;
    } finally { clearTimeout(t); }
  }

  async get(url) {
    const res = await this._fetch(url, { method: "GET" });
    const html = await res.text();
    return { url, status: res.status, html, $: cheerio.load(html) };
  }

  // POST x-www-form-urlencoded, auto-including current hidden fields from `page`.
  async postForm(actionUrl, fields, page) {
    const form = new URLSearchParams();
    if (page?.$) {
      page.$('input[type="hidden"]').each((_, el) => {
        const n = page.$(el).attr("name");
        if (n) form.set(n, page.$(el).attr("value") || "");
      });
    }
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    const res = await this._fetch(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": new URL(actionUrl).origin,
        "Referer": actionUrl,
      },
      body: form.toString(),
    });
    const html = await res.text();
    return { url: actionUrl, status: res.status, html, $: cheerio.load(html) };
  }
}

export const clean = (s) => (s || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
