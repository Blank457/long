/* ===== 云享 CloudShare · 配置管理 ===== */
(function (global) {
  "use strict";

  const KEY = "cloudshare_config_v1";

  const DEFAULT = {
    bucket: "",
    endpoint: "obs.cn-north-4.myhuaweicloud.com",
    stsUrl: "",
    ak: "",
    sk: "",
    region: "cn-north-4",
    demoMode: true
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return Object.assign({}, DEFAULT, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULT);
    }
  }

  function save(cfg) {
    const merged = Object.assign({}, DEFAULT, cfg);
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isConfigured() {
    const c = load();
    return !!(c.bucket && c.endpoint && (c.stsUrl || (c.ak && c.sk)));
  }

  global.CloudShareConfig = { load, save, clear, isConfigured, DEFAULT };
})(window);