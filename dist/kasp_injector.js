(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/core/bonusPickup.ts
  function readBonusPosition(value) {
    if (!value || typeof value !== "object") return null;
    try {
      const point = value;
      const coordinates = "x" in point ? [point.x, point.y, point.z] : [point.f20_1, point.g20_1, point.h20_1];
      if (!coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) return null;
      const [x, y, z] = coordinates;
      return { x, y, z };
    } catch {
      return null;
    }
  }
  function snapshotBonusArgument(value) {
    const visited = /* @__PURE__ */ new Set();
    let budget = 120;
    function walk(current, depth) {
      if (typeof current === "string") return current.slice(0, 160);
      if (current === null || typeof current === "number" || typeof current === "boolean") return current;
      if (typeof current !== "object") return `[${typeof current}]`;
      if (visited.has(current)) return "[cycle]";
      visited.add(current);
      const id = modelId(current);
      if (id) return { longId: id };
      if (depth >= 3 || budget-- <= 0) return "[depth/budget limit]";
      const result = {};
      try {
        const keys = Object.keys(current);
        for (const key of keys.slice(0, 12)) {
          try {
            result[key] = walk(current[key], depth + 1);
          } catch {
            result[key] = "[inaccessible]";
          }
        }
        if (keys.length > 12) result.__omittedFields = keys.length - 12;
      } catch {
        return "[inaccessible]";
      }
      return result;
    }
    return walk(value, 0);
  }
  function createBonusDiagnostics(output, initiallyEnabled = false, now = Date.now) {
    let enabled = initiallyEnabled;
    const records = [];
    return {
      record(record) {
        if (!enabled) return;
        try {
          const snapshot = { at: now(), ...record };
          records.push(snapshot);
          if (records.length > 200) records.shift();
          output(snapshot);
        } catch {
        }
      },
      enable(value = true) {
        enabled = value;
      },
      clear() {
        records.length = 0;
      },
      export() {
        return JSON.stringify(records, null, 2);
      }
    };
  }
  function modelId(value) {
    if (!value || typeof value !== "object") return null;
    try {
      const keys = Object.keys(value);
      if (keys.length !== 2) return null;
      const fields = keys.map((key) => value[key]);
      if (!fields.every((field) => typeof field === "number")) return null;
      const id = String(value);
      return /^-?\d{4,20}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }
  function findModel(value, depth = 0, visited = /* @__PURE__ */ new Set()) {
    if (!value || typeof value !== "object" || depth > 3 || visited.has(value)) return null;
    visited.add(value);
    const direct = modelId(value);
    if (direct) return direct;
    try {
      for (const key of Object.keys(value).slice(0, 20)) {
        let child;
        try {
          child = value[key];
        } catch {
          continue;
        }
        const found = findModel(child, depth + 1, visited);
        if (found) return found;
      }
    } catch {
    }
    return null;
  }
  function bonusModels(value, excludedField) {
    if (!value || typeof value !== "object") return [];
    const models = [];
    try {
      for (const key of Object.keys(value).slice(0, 8)) {
        if (key === excludedField) continue;
        let child;
        try {
          child = value[key];
        } catch {
          continue;
        }
        if (child && typeof child === "object") models.push(findModel(child));
      }
    } catch {
    }
    return models;
  }
  function createBonusPickupBridge(emit, diagnose, diagnosticEnabled = () => !!diagnose) {
    const soundModels = /* @__PURE__ */ new Map();
    const pending = /* @__PURE__ */ new Map();
    function log(record) {
      try {
        diagnose?.(record);
      } catch {
      }
    }
    function resolve(data, excludedField) {
      const candidate = bonusModels(data, excludedField)[0] || (excludedField ? null : findModel(data));
      return candidate && (soundModels.has(candidate) ? soundModels.get(candidate) || null : candidate);
    }
    return {
      register(data, instanceId, x, y, z) {
        const [box, sound] = bonusModels(data);
        if (box && sound) {
          if (!soundModels.has(sound)) soundModels.set(sound, box);
          else if (soundModels.get(sound) !== box) soundModels.set(sound, null);
        }
        if (diagnosticEnabled()) {
          const position = [x, y, z].every((value) => typeof value === "number" && Number.isFinite(value)) ? { x, y, z } : null;
          log({
            kind: "register",
            model: box,
            sound,
            instanceId: snapshotBonusArgument(instanceId),
            position,
            coordinateArguments: position ? void 0 : [x, y, z].map(snapshotBonusArgument)
          });
        }
      },
      pickup(data) {
        try {
          const box = resolve(data);
          log({ kind: "pickup-model", model: box });
          if (box) emit(box);
        } catch {
        }
        return data;
      },
      prepare(data, field) {
        const sound = data[field];
        try {
          const entry = { model: resolve(data, field) };
          const entries = pending.get(sound) || [];
          entries.push(entry);
          pending.set(sound, entries);
          log({ kind: "pickup-model", model: entry.model });
          Promise.resolve().then(() => {
            const stack = pending.get(sound);
            if (!stack) return;
            const index = stack.indexOf(entry);
            if (index >= 0) stack.splice(index, 1);
            if (!stack.length) pending.delete(sound);
          });
        } catch {
        }
        return sound;
      },
      context(first, second) {
        try {
          const entries = pending.get(first);
          const entry = entries?.pop();
          if (entries && !entries.length) pending.delete(first);
          const model = entry?.model || null;
          const position = readBonusPosition(second);
          if (diagnosticEnabled()) log({
            kind: "pickup-context",
            model,
            position,
            paired: !!entry,
            argument1: snapshotBonusArgument(first),
            argument2: snapshotBonusArgument(second)
          });
          if (model) emit(model, position);
        } catch {
        }
      }
    };
  }
  function patchBonusPickups(code, report) {
    let pickupHook = false;
    let contextHook = false;
    let registrationHooks = 0;
    const pickup = /[\w$]+\([\w$]+\)\.(\w+)=function\((\w+),(\w+)\)\{\w+\(this,this\.\w+,\2,\3,"bonus pickup"\)\}/.exec(code);
    if (pickup) {
      const original = pickup[0];
      const openingEnd = original.indexOf("{") + 1;
      const observed = original.slice(0, openingEnd) + "try{window.__kaspBonusContext&&window.__kaspBonusContext(" + pickup[2] + "," + pickup[3] + ")}catch(_kaspBonusError){};" + original.slice(openingEnd);
      code = code.replace(original, () => observed);
      contextHook = true;
      const call = new RegExp("\\." + pickup[1] + "\\(([\\w$]+\\([\\w$]+\\))\\.([\\w$]+),");
      pickupHook = call.test(code);
      code = code.replace(call, "." + pickup[1] + '(window.__kaspBonusPrepare($1,"$2"),');
    }
    const registration = /([\w$]+\([\w$]+\)\.\w+=function\(([\w$]+),([\w$]+),([\w$]+),([\w$]+),([\w$]+),[\w$]+\)\{)(var \w+,\w+,\w+=this\.\w+\.\w+\(\);)/g;
    code = code.replace(registration, (match, opening, id, data, x, y, z, locals, offset) => {
      if (!code.slice(offset, offset + 900).includes("onBonusCollision")) return match;
      registrationHooks++;
      return opening + "window.__kaspBonusRegister(" + [data, id, x, y, z].join(",") + ");" + locals;
    });
    try {
      report?.({ kind: "hooks", pickupHook, contextHook, registrationHooks });
    } catch {
    }
    return code;
  }
  var BONUS_PICKUP_MESSAGE;
  var init_bonusPickup = __esm({
    "src/core/bonusPickup.ts"() {
      BONUS_PICKUP_MESSAGE = "kasp:bonus-pickup";
    }
  });

  // src/kasp_injector.ts
  var require_kasp_injector = __commonJS({
    "src/kasp_injector.ts"() {
      init_bonusPickup();
      (function() {
        "use strict";
        const debugKey = "kasp_bonus_debug";
        let debugEnabled = false;
        try {
          debugEnabled = localStorage.getItem(debugKey) === "true";
        } catch {
        }
        const diagnostics = createBonusDiagnostics((record) => console.log("[KASP Bonus]", JSON.stringify(record)), debugEnabled);
        let hookStatus = null;
        window.__kaspBonusDebug = {
          enable(value = true) {
            debugEnabled = value;
            diagnostics.enable(value);
            try {
              localStorage.setItem(debugKey, String(value));
            } catch {
            }
            if (value && hookStatus) diagnostics.record(hookStatus);
          },
          clear: diagnostics.clear,
          export: diagnostics.export
        };
        const bonusBridge = createBonusPickupBridge((model, position) => {
          window.postMessage({ type: BONUS_PICKUP_MESSAGE, detail: { model, position: position || null } }, "*");
        }, diagnostics.record, () => debugEnabled);
        window.__kaspBonusPickup = bonusBridge.pickup;
        window.__kaspBonusPrepare = bonusBridge.prepare;
        window.__kaspBonusRegister = bonusBridge.register;
        window.__kaspBonusContext = bonusBridge.context;
        const KNOWN_MODES = /* @__PURE__ */ new Set([
          "DM",
          "TDM",
          "CTF",
          "CP",
          "SGE",
          "RGB",
          "JGR",
          "TJR",
          "ASL",
          "AR"
        ]);
        window.__kaspSendAction = function(className, obj) {
          try {
            let safeWalk = function(o, depth) {
              if (depth > 2 || !o || typeof o !== "object" || seen.has(o)) return;
              seen.add(o);
              let keys = [];
              try {
                keys = Object.keys(o);
              } catch (e) {
                return;
              }
              for (let i = 0; i < keys.length; i++) {
                let k = keys[i];
                let v;
                try {
                  v = o[k];
                } catch (e) {
                  continue;
                }
                if (v != null) {
                  if (typeof v === "string" || typeof v === "number") {
                    let strVal = String(v).trim();
                    if (strVal && strVal.length >= 2 && strVal.length < 30) {
                      res.push(strVal);
                    }
                  } else if (typeof v === "object" && depth < 2) {
                    safeWalk(v, depth + 1);
                  }
                }
              }
            };
            let res = [className];
            let seen = /* @__PURE__ */ new Set();
            safeWalk(obj, 0);
            window.postMessage({ type: "kasp:useraction", detail: res }, "*");
          } catch (e) {
          }
        };
        window.__kaspBattleStats = function(obj) {
          try {
            if (!obj || typeof obj !== "object") return;
            let keys;
            try {
              keys = Object.keys(obj);
            } catch (e) {
              return;
            }
            let mode = null;
            let isPro = null;
            for (let i = 0; i < keys.length; i++) {
              let v;
              try {
                v = obj[keys[i]];
              } catch (e) {
                continue;
              }
              if (typeof v !== "string") continue;
              const trimmed = v.trim();
              if (!trimmed) continue;
              const upper = trimmed.toUpperCase();
              if (!mode) {
                if (KNOWN_MODES.has(upper)) {
                  mode = upper;
                } else {
                  const m = /\s+([A-Z]{2,3})$/.exec(upper);
                  if (m && KNOWN_MODES.has(m[1])) mode = m[1];
                }
              }
              if (isPro === null) {
                if (/(^|[\s\-])PRO([\s\-]|$)/.test(trimmed) || /(^|[\s\-])ПРО([\s\-]|$)/.test(trimmed)) {
                  isPro = true;
                }
              }
            }
            if (isPro === null) isPro = false;
            if (mode) {
              window.postMessage(
                { type: "kasp:battle-mode", detail: mode },
                "*"
              );
            }
            window.postMessage(
              { type: "kasp:battle-kind", detail: isPro ? "PRO" : "MM" },
              "*"
            );
          } catch (e) {
          }
        };
        let bundleIntercepted = false;
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
              if (!bundleIntercepted && node instanceof HTMLScriptElement && node.src.includes("/static/js/main.")) {
                bundleIntercepted = true;
                const originalScript = document.createElement("script");
                for (const attribute of Array.from(node.attributes)) {
                  originalScript.setAttribute(attribute.name, attribute.value);
                }
                originalScript.async = node.async;
                originalScript.nonce = node.nonce;
                node.type = "javascript/blocked";
                node.remove();
                observer.disconnect();
                fetch(node.src).then((res) => {
                  if (!res.ok) throw new Error(`Game bundle request failed: HTTP ${res.status}`);
                  return res.text();
                }).then((code) => {
                  code = patchBonusPickups(code, (status) => {
                    hookStatus = status;
                    diagnostics.record(status);
                  });
                  const match = /return"TankUserActionLog\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                  if (match) {
                    const propName = match[1];
                    const p = new RegExp(`(function [\\w$]+\\([^)]{1,150}\\)\\{[^{}]{0,800}?this\\.${propName}=[\\w$]+(?:,this\\.[\\w$]+=[\\w$]+){0,30})\\}`);
                    if (p.test(code)) {
                      code = code.replace(p, `$1, window.__kaspSendAction("TankUserActionLog", this)}`);
                    }
                  }
                  const bsMatch = /return"BattleStatistics\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                  if (bsMatch) {
                    const firstField = bsMatch[1];
                    const ctor = new RegExp(
                      "(function [\\w$]+\\([^)]{5,400}\\)\\{[^{}]{0,1200}?this\\." + firstField + "=[\\w$]+(?:,this\\.[\\w$]+=[\\w$]+){10,60})\\}"
                    );
                    if (ctor.test(code)) {
                      code = code.replace(ctor, "$1, window.__kaspBattleStats(this)}");
                    }
                  }
                  const script = document.createElement("script");
                  script.type = originalScript.type;
                  script.nonce = originalScript.nonce;
                  script.textContent = code;
                  (document.head || document.documentElement).appendChild(script);
                }).catch((error) => {
                  console.error("[Kaspersky Inventions] Bundle injection failed; loading the original game script:", error);
                  originalScript.addEventListener("error", () => {
                    console.error("[Kaspersky Inventions] The original game script also failed to load:", originalScript.src);
                  }, { once: true });
                  try {
                    (document.head || document.documentElement).appendChild(originalScript);
                  } catch (restoreError) {
                    console.error("[Kaspersky Inventions] Could not restore the original game script:", restoreError);
                  }
                });
              }
            }
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      })();
    }
  });
  require_kasp_injector();
})();
