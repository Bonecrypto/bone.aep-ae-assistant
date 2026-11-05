
  // ---------- Точка входа ----------
  global.AEA = {
    __version: VERSION,
    run: function (name, args) {
      try {
        var fn = tools[name];
        if (!fn) return stringify(fail("UNKNOWN_TOOL", { tool: name }));
        return stringify(fn(args || {}));
      } catch (e) {
        return stringify(fail("EXCEPTION", { message: String(e), line: e.line }));
      }
    }
  };
})($.global);
