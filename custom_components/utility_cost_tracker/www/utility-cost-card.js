/*! utility-cost-card 1.0.0 | MIT License */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i5 = decorators.length - 1, decorator; i5 >= 0; i5--)
    if (decorator = decorators[i5])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// node_modules/@lit/reactive-element/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = /* @__PURE__ */ Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t3, e5, o6) {
    if (this._$cssResult$ = true, o6 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t3, this.t = e5;
  }
  get styleSheet() {
    let t3 = this.o;
    const s4 = this.t;
    if (e && void 0 === t3) {
      const e5 = void 0 !== s4 && 1 === s4.length;
      e5 && (t3 = o.get(s4)), void 0 === t3 && ((this.o = t3 = new CSSStyleSheet()).replaceSync(this.cssText), e5 && o.set(s4, t3));
    }
    return t3;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t3) => new n("string" == typeof t3 ? t3 : t3 + "", void 0, s);
var i = (t3, ...e5) => {
  const o6 = 1 === t3.length ? t3[0] : e5.reduce((e6, s4, o7) => e6 + ((t4) => {
    if (true === t4._$cssResult$) return t4.cssText;
    if ("number" == typeof t4) return t4;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t4 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s4) + t3[o7 + 1], t3[0]);
  return new n(o6, t3, s);
};
var S = (s4, o6) => {
  if (e) s4.adoptedStyleSheets = o6.map((t3) => t3 instanceof CSSStyleSheet ? t3 : t3.styleSheet);
  else for (const e5 of o6) {
    const o7 = document.createElement("style"), n5 = t.litNonce;
    void 0 !== n5 && o7.setAttribute("nonce", n5), o7.textContent = e5.cssText, s4.appendChild(o7);
  }
};
var c = e ? (t3) => t3 : (t3) => t3 instanceof CSSStyleSheet ? ((t4) => {
  let e5 = "";
  for (const s4 of t4.cssRules) e5 += s4.cssText;
  return r(e5);
})(t3) : t3;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t3, s4) => t3;
var u = { toAttribute(t3, s4) {
  switch (s4) {
    case Boolean:
      t3 = t3 ? l : null;
      break;
    case Object:
    case Array:
      t3 = null == t3 ? t3 : JSON.stringify(t3);
  }
  return t3;
}, fromAttribute(t3, s4) {
  let i5 = t3;
  switch (s4) {
    case Boolean:
      i5 = null !== t3;
      break;
    case Number:
      i5 = null === t3 ? null : Number(t3);
      break;
    case Object:
    case Array:
      try {
        i5 = JSON.parse(t3);
      } catch (t4) {
        i5 = null;
      }
  }
  return i5;
} };
var f = (t3, s4) => !i2(t3, s4);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ?? (Symbol.metadata = /* @__PURE__ */ Symbol("metadata")), a.litPropertyMetadata ?? (a.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
var y = class extends HTMLElement {
  static addInitializer(t3) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t3);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t3, s4 = b) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t3) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t3, s4), !s4.noAccessor) {
      const i5 = /* @__PURE__ */ Symbol(), h3 = this.getPropertyDescriptor(t3, i5, s4);
      void 0 !== h3 && e2(this.prototype, t3, h3);
    }
  }
  static getPropertyDescriptor(t3, s4, i5) {
    const { get: e5, set: r6 } = h(this.prototype, t3) ?? { get() {
      return this[s4];
    }, set(t4) {
      this[s4] = t4;
    } };
    return { get: e5, set(s5) {
      const h3 = e5?.call(this);
      r6?.call(this, s5), this.requestUpdate(t3, h3, i5);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t3) {
    return this.elementProperties.get(t3) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t3 = n2(this);
    t3.finalize(), void 0 !== t3.l && (this.l = [...t3.l]), this.elementProperties = new Map(t3.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t4 = this.properties, s4 = [...r2(t4), ...o2(t4)];
      for (const i5 of s4) this.createProperty(i5, t4[i5]);
    }
    const t3 = this[Symbol.metadata];
    if (null !== t3) {
      const s4 = litPropertyMetadata.get(t3);
      if (void 0 !== s4) for (const [t4, i5] of s4) this.elementProperties.set(t4, i5);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t4, s4] of this.elementProperties) {
      const i5 = this._$Eu(t4, s4);
      void 0 !== i5 && this._$Eh.set(i5, t4);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s4) {
    const i5 = [];
    if (Array.isArray(s4)) {
      const e5 = new Set(s4.flat(1 / 0).reverse());
      for (const s5 of e5) i5.unshift(c(s5));
    } else void 0 !== s4 && i5.push(c(s4));
    return i5;
  }
  static _$Eu(t3, s4) {
    const i5 = s4.attribute;
    return false === i5 ? void 0 : "string" == typeof i5 ? i5 : "string" == typeof t3 ? t3.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t3) => this.enableUpdating = t3), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t3) => t3(this));
  }
  addController(t3) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t3), void 0 !== this.renderRoot && this.isConnected && t3.hostConnected?.();
  }
  removeController(t3) {
    this._$EO?.delete(t3);
  }
  _$E_() {
    const t3 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i5 of s4.keys()) this.hasOwnProperty(i5) && (t3.set(i5, this[i5]), delete this[i5]);
    t3.size > 0 && (this._$Ep = t3);
  }
  createRenderRoot() {
    const t3 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t3, this.constructor.elementStyles), t3;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(true), this._$EO?.forEach((t3) => t3.hostConnected?.());
  }
  enableUpdating(t3) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t3) => t3.hostDisconnected?.());
  }
  attributeChangedCallback(t3, s4, i5) {
    this._$AK(t3, i5);
  }
  _$ET(t3, s4) {
    const i5 = this.constructor.elementProperties.get(t3), e5 = this.constructor._$Eu(t3, i5);
    if (void 0 !== e5 && true === i5.reflect) {
      const h3 = (void 0 !== i5.converter?.toAttribute ? i5.converter : u).toAttribute(s4, i5.type);
      this._$Em = t3, null == h3 ? this.removeAttribute(e5) : this.setAttribute(e5, h3), this._$Em = null;
    }
  }
  _$AK(t3, s4) {
    const i5 = this.constructor, e5 = i5._$Eh.get(t3);
    if (void 0 !== e5 && this._$Em !== e5) {
      const t4 = i5.getPropertyOptions(e5), h3 = "function" == typeof t4.converter ? { fromAttribute: t4.converter } : void 0 !== t4.converter?.fromAttribute ? t4.converter : u;
      this._$Em = e5;
      const r6 = h3.fromAttribute(s4, t4.type);
      this[e5] = r6 ?? this._$Ej?.get(e5) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t3, s4, i5, e5 = false, h3) {
    if (void 0 !== t3) {
      const r6 = this.constructor;
      if (false === e5 && (h3 = this[t3]), i5 ?? (i5 = r6.getPropertyOptions(t3)), !((i5.hasChanged ?? f)(h3, s4) || i5.useDefault && i5.reflect && h3 === this._$Ej?.get(t3) && !this.hasAttribute(r6._$Eu(t3, i5)))) return;
      this.C(t3, s4, i5);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t3, s4, { useDefault: i5, reflect: e5, wrapped: h3 }, r6) {
    i5 && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t3) && (this._$Ej.set(t3, r6 ?? s4 ?? this[t3]), true !== h3 || void 0 !== r6) || (this._$AL.has(t3) || (this.hasUpdated || i5 || (s4 = void 0), this._$AL.set(t3, s4)), true === e5 && this._$Em !== t3 && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t3));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t4) {
      Promise.reject(t4);
    }
    const t3 = this.scheduleUpdate();
    return null != t3 && await t3, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [t5, s5] of this._$Ep) this[t5] = s5;
        this._$Ep = void 0;
      }
      const t4 = this.constructor.elementProperties;
      if (t4.size > 0) for (const [s5, i5] of t4) {
        const { wrapped: t5 } = i5, e5 = this[s5];
        true !== t5 || this._$AL.has(s5) || void 0 === e5 || this.C(s5, void 0, i5, e5);
      }
    }
    let t3 = false;
    const s4 = this._$AL;
    try {
      t3 = this.shouldUpdate(s4), t3 ? (this.willUpdate(s4), this._$EO?.forEach((t4) => t4.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t3 = false, this._$EM(), s5;
    }
    t3 && this._$AE(s4);
  }
  willUpdate(t3) {
  }
  _$AE(t3) {
    this._$EO?.forEach((t4) => t4.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t3)), this.updated(t3);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t3) {
    return true;
  }
  update(t3) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t4) => this._$ET(t4, this[t4]))), this._$EM();
  }
  updated(t3) {
  }
  firstUpdated(t3) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ?? (a.reactiveElementVersions = [])).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = (t3) => t3;
var s2 = t2.trustedTypes;
var e3 = s2 ? s2.createPolicy("lit-html", { createHTML: (t3) => t3 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t3) => null === t3 || "object" != typeof t3 && "function" != typeof t3;
var u2 = Array.isArray;
var d2 = (t3) => u2(t3) || "function" == typeof t3?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t3) => (i5, ...s4) => ({ _$litType$: t3, strings: i5, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t3, i5) {
  if (!u2(t3) || !t3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e3 ? e3.createHTML(i5) : i5;
}
var N = (t3, i5) => {
  const s4 = t3.length - 1, e5 = [];
  let n5, l3 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c4 = v;
  for (let i6 = 0; i6 < s4; i6++) {
    const s5 = t3[i6];
    let a3, u3, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u3 = c4.exec(s5), null !== u3); ) f3 = c4.lastIndex, c4 === v ? "!--" === u3[1] ? c4 = _ : void 0 !== u3[1] ? c4 = m : void 0 !== u3[2] ? (y2.test(u3[2]) && (n5 = RegExp("</" + u3[2], "g")), c4 = p2) : void 0 !== u3[3] && (c4 = p2) : c4 === p2 ? ">" === u3[0] ? (c4 = n5 ?? v, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? p2 : '"' === u3[3] ? $ : g) : c4 === $ || c4 === g ? c4 = p2 : c4 === _ || c4 === m ? c4 = v : (c4 = p2, n5 = void 0);
    const x2 = c4 === p2 && t3[i6 + 1].startsWith("/>") ? " " : "";
    l3 += c4 === v ? s5 + r3 : d3 >= 0 ? (e5.push(a3), s5.slice(0, d3) + h2 + s5.slice(d3) + o3 + x2) : s5 + o3 + (-2 === d3 ? i6 : x2);
  }
  return [V(t3, l3 + (t3[s4] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e5];
};
var S2 = class _S {
  constructor({ strings: t3, _$litType$: i5 }, e5) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u3 = t3.length - 1, d3 = this.parts, [f3, v2] = N(t3, i5);
    if (this.el = _S.createElement(f3, e5), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t4 = this.el.content.firstChild;
      t4.replaceWith(...t4.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u3; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t4 of r6.getAttributeNames()) if (t4.endsWith(h2)) {
          const i6 = v2[a3++], s4 = r6.getAttribute(t4).split(o3), e6 = /([.?@])?(.*)/.exec(i6);
          d3.push({ type: 1, index: l3, name: e6[2], strings: s4, ctor: "." === e6[1] ? I : "?" === e6[1] ? L : "@" === e6[1] ? z : H }), r6.removeAttribute(t4);
        } else t4.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t4));
        if (y2.test(r6.tagName)) {
          const t4 = r6.textContent.split(o3), i6 = t4.length - 1;
          if (i6 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i6; s4++) r6.append(t4[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t4[i6], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t4 = -1;
        for (; -1 !== (t4 = r6.data.indexOf(o3, t4 + 1)); ) d3.push({ type: 7, index: l3 }), t4 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t3, i5) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t3, s4;
  }
};
function M(t3, i5, s4 = t3, e5) {
  if (i5 === E) return i5;
  let h3 = void 0 !== e5 ? s4._$Co?.[e5] : s4._$Cl;
  const o6 = a2(i5) ? void 0 : i5._$litDirective$;
  return h3?.constructor !== o6 && (h3?._$AO?.(false), void 0 === o6 ? h3 = void 0 : (h3 = new o6(t3), h3._$AT(t3, s4, e5)), void 0 !== e5 ? (s4._$Co ?? (s4._$Co = []))[e5] = h3 : s4._$Cl = h3), void 0 !== h3 && (i5 = M(t3, h3._$AS(t3, i5.values), h3, e5)), i5;
}
var R = class {
  constructor(t3, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t3, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t3) {
    const { el: { content: i5 }, parts: s4 } = this._$AD, e5 = (t3?.creationScope ?? l2).importNode(i5, true);
    P.currentNode = e5;
    let h3 = P.nextNode(), o6 = 0, n5 = 0, r6 = s4[0];
    for (; void 0 !== r6; ) {
      if (o6 === r6.index) {
        let i6;
        2 === r6.type ? i6 = new k(h3, h3.nextSibling, this, t3) : 1 === r6.type ? i6 = new r6.ctor(h3, r6.name, r6.strings, this, t3) : 6 === r6.type && (i6 = new Z(h3, this, t3)), this._$AV.push(i6), r6 = s4[++n5];
      }
      o6 !== r6?.index && (h3 = P.nextNode(), o6++);
    }
    return P.currentNode = l2, e5;
  }
  p(t3) {
    let i5 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t3, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t3[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t3, i5, s4, e5) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t3, this._$AB = i5, this._$AM = s4, this.options = e5, this._$Cv = e5?.isConnected ?? true;
  }
  get parentNode() {
    let t3 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t3?.nodeType && (t3 = i5.parentNode), t3;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t3, i5 = this) {
    t3 = M(this, t3, i5), a2(t3) ? t3 === A || null == t3 || "" === t3 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t3 !== this._$AH && t3 !== E && this._(t3) : void 0 !== t3._$litType$ ? this.$(t3) : void 0 !== t3.nodeType ? this.T(t3) : d2(t3) ? this.k(t3) : this._(t3);
  }
  O(t3) {
    return this._$AA.parentNode.insertBefore(t3, this._$AB);
  }
  T(t3) {
    this._$AH !== t3 && (this._$AR(), this._$AH = this.O(t3));
  }
  _(t3) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t3 : this.T(l2.createTextNode(t3)), this._$AH = t3;
  }
  $(t3) {
    const { values: i5, _$litType$: s4 } = t3, e5 = "number" == typeof s4 ? this._$AC(t3) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e5) this._$AH.p(i5);
    else {
      const t4 = new R(e5, this), s5 = t4.u(this.options);
      t4.p(i5), this.T(s5), this._$AH = t4;
    }
  }
  _$AC(t3) {
    let i5 = C.get(t3.strings);
    return void 0 === i5 && C.set(t3.strings, i5 = new S2(t3)), i5;
  }
  k(t3) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s4, e5 = 0;
    for (const h3 of t3) e5 === i5.length ? i5.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i5[e5], s4._$AI(h3), e5++;
    e5 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e5), i5.length = e5);
  }
  _$AR(t3 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t3 !== this._$AB; ) {
      const s5 = i3(t3).nextSibling;
      i3(t3).remove(), t3 = s5;
    }
  }
  setConnected(t3) {
    void 0 === this._$AM && (this._$Cv = t3, this._$AP?.(t3));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t3, i5, s4, e5, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t3, this.name = i5, this._$AM = e5, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t3, i5 = this, s4, e5) {
    const h3 = this.strings;
    let o6 = false;
    if (void 0 === h3) t3 = M(this, t3, i5, 0), o6 = !a2(t3) || t3 !== this._$AH && t3 !== E, o6 && (this._$AH = t3);
    else {
      const e6 = t3;
      let n5, r6;
      for (t3 = h3[0], n5 = 0; n5 < h3.length - 1; n5++) r6 = M(this, e6[s4 + n5], i5, n5), r6 === E && (r6 = this._$AH[n5]), o6 || (o6 = !a2(r6) || r6 !== this._$AH[n5]), r6 === A ? t3 = A : t3 !== A && (t3 += (r6 ?? "") + h3[n5 + 1]), this._$AH[n5] = r6;
    }
    o6 && !e5 && this.j(t3);
  }
  j(t3) {
    t3 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t3 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t3) {
    this.element[this.name] = t3 === A ? void 0 : t3;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t3) {
    this.element.toggleAttribute(this.name, !!t3 && t3 !== A);
  }
};
var z = class extends H {
  constructor(t3, i5, s4, e5, h3) {
    super(t3, i5, s4, e5, h3), this.type = 5;
  }
  _$AI(t3, i5 = this) {
    if ((t3 = M(this, t3, i5, 0) ?? A) === E) return;
    const s4 = this._$AH, e5 = t3 === A && s4 !== A || t3.capture !== s4.capture || t3.once !== s4.once || t3.passive !== s4.passive, h3 = t3 !== A && (s4 === A || e5);
    e5 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t3), this._$AH = t3;
  }
  handleEvent(t3) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t3) : this._$AH.handleEvent(t3);
  }
};
var Z = class {
  constructor(t3, i5, s4) {
    this.element = t3, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t3) {
    M(this, t3);
  }
};
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ?? (t2.litHtmlVersions = [])).push("3.3.3");
var D = (t3, i5, s4) => {
  const e5 = s4?.renderBefore ?? i5;
  let h3 = e5._$litPart$;
  if (void 0 === h3) {
    const t4 = s4?.renderBefore ?? null;
    e5._$litPart$ = h3 = new k(i5.insertBefore(c3(), t4), t4, void 0, s4 ?? {});
  }
  return h3._$AI(t3), h3;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var _a;
    const t3 = super.createRenderRoot();
    return (_a = this.renderOptions).renderBefore ?? (_a.renderBefore = t3.firstChild), t3;
  }
  update(t3) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t3), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i4 });
(s3.litElementVersions ?? (s3.litElementVersions = [])).push("4.2.2");

// node_modules/@lit/reactive-element/decorators/property.js
var o5 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var r4 = (t3 = o5, e5, r6) => {
  const { kind: n5, metadata: i5 } = r6;
  let s4 = globalThis.litPropertyMetadata.get(i5);
  if (void 0 === s4 && globalThis.litPropertyMetadata.set(i5, s4 = /* @__PURE__ */ new Map()), "setter" === n5 && ((t3 = Object.create(t3)).wrapped = true), s4.set(r6.name, t3), "accessor" === n5) {
    const { name: o6 } = r6;
    return { set(r7) {
      const n6 = e5.get.call(this);
      e5.set.call(this, r7), this.requestUpdate(o6, n6, t3, true, r7);
    }, init(e6) {
      return void 0 !== e6 && this.C(o6, void 0, t3, e6), e6;
    } };
  }
  if ("setter" === n5) {
    const { name: o6 } = r6;
    return function(r7) {
      const n6 = this[o6];
      e5.call(this, r7), this.requestUpdate(o6, n6, t3, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n5);
};
function n4(t3) {
  return (e5, o6) => "object" == typeof o6 ? r4(t3, e5, o6) : ((t4, e6, o7) => {
    const r6 = e6.hasOwnProperty(o7);
    return e6.constructor.createProperty(o7, t4), r6 ? Object.getOwnPropertyDescriptor(e6, o7) : void 0;
  })(t3, e5, o6);
}

// node_modules/@lit/reactive-element/decorators/state.js
function r5(r6) {
  return n4({ ...r6, state: true, attribute: false });
}

// src/const.ts
var CARD_VERSION = "1.0.0";
var DOMAIN = "utility_cost_tracker";
var DEFAULT_SCROLL_INDICATOR = "both";
var REFRESH_MS = 6e4;
var STATISTICS_DELAY_MS = 9e4;
var RATE_DAYS = 14;
var ICONS = {
  electricity: "mdi:lightning-bolt",
  water: "mdi:water",
  gas: "mdi:fire",
  district_heating: "mdi:radiator",
  other: "mdi:cash"
};
var ELEMENT_COLORS = [
  "var(--utility-cost-color-1, var(--primary-color, #03a9f4))",
  "var(--utility-cost-color-2, var(--purple-color, #926bc7))",
  "var(--utility-cost-color-3, var(--success-color, #43a047))",
  "var(--utility-cost-color-4, var(--warning-color, #ffa600))"
];

// src/periods.ts
var PERIODS = ["hour", "day", "week", "month", "year"];
var PARTS = { day: "hour", week: "day", month: "day", year: "week" };
var HOUR_MS = 36e5;
var formats = /* @__PURE__ */ new Map();
function wall(at, zone) {
  const key = zone ?? "";
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    formats.set(key, format);
  }
  const parts = {};
  for (const part of format.formatToParts(at)) {
    parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}
var asUtc = (reading) => Date.UTC(reading.year, reading.month - 1, reading.day, reading.hour, reading.minute);
function moment(reading, zone) {
  const target = asUtc(reading);
  let at = target - (asUtc(wall(target, zone)) - target);
  at = target - (asUtc(wall(at, zone)) - at);
  const earlier = at - HOUR_MS;
  return asUtc(wall(earlier, zone)) === target ? earlier : at;
}
function periodStart(period, at, zone) {
  const reading = wall(at, zone);
  if (period === "hour") {
    return at - reading.minute * 6e4 - at % 6e4;
  }
  const start = { ...reading, hour: 0, minute: 0 };
  if (period === "week") {
    const weekday = (new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay() + 6) % 7;
    start.day -= weekday;
  } else if (period === "month") {
    start.day = 1;
  } else if (period === "year") {
    start.day = 1;
    start.month = 1;
  }
  return moment(normal(start), zone);
}
function shift(period, start, count, zone) {
  if (period === "hour") {
    return start + count * HOUR_MS;
  }
  const reading = wall(start, zone);
  if (period === "day") {
    reading.day += count;
  } else if (period === "week") {
    reading.day += 7 * count;
  } else if (period === "month") {
    reading.month += count;
  } else {
    reading.year += count;
  }
  return moment(normal(reading), zone);
}
function normal(reading) {
  const date = new Date(Date.UTC(reading.year, reading.month - 1, reading.day, reading.hour, reading.minute));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}
function covers(period, other) {
  return PERIODS.indexOf(period) >= PERIODS.indexOf(other);
}
function weekNumber(start, zone) {
  const reading = wall(start, zone);
  const thursday = new Date(Date.UTC(reading.year, reading.month - 1, reading.day + 3));
  const first = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - first) / (7 * 24 * HOUR_MS)) + 1;
}

// src/cost.ts
function emptyLedger() {
  return { items: {}, consumption: 0 };
}
function add(ledger, more, factor = 1) {
  var _a;
  for (const [id, amount] of Object.entries(more.items)) {
    const sum = (_a = ledger.items)[id] ?? (_a[id] = { amount: 0, tax: 0 });
    sum.amount += amount.amount * factor;
    sum.tax += amount.tax * factor;
  }
  ledger.consumption += more.consumption * factor;
  return ledger;
}
var REMOVED = "";
var REMOVED_COLOR = "var(--secondary-text-color)";
function inPeriod(item, period) {
  return item.kind !== "fixed_fee" || item.fee_period === null || covers(period, item.fee_period);
}
function elementColor(site, element) {
  return ELEMENT_COLORS[site.elements.indexOf(element) % ELEMENT_COLORS.length];
}
function itemColor(site, item, picked) {
  const mine = site.items.filter((other) => other.element === item.element && picked.includes(other.id));
  const place = mine.indexOf(item);
  const element = site.elements.find((candidate) => candidate.id === item.element);
  if (place < 0 || !element) {
    return void 0;
  }
  const share = Math.round(68 - place * (48 / mine.length));
  return `color-mix(in srgb, ${elementColor(site, element)} ${share}%, var(--primary-text-color))`;
}
function shown(site, ledger, period, options) {
  const result = { elements: [], beforeTax: 0, tax: 0, total: 0, segments: [] };
  for (const element of site.elements) {
    if (options.hidden.includes(element.id)) {
      continue;
    }
    const color = elementColor(site, element);
    const items = [];
    const picked = [];
    let beforeTax = 0;
    let tax = 0;
    let rest = 0;
    for (const item of site.items) {
      if (item.element !== element.id || !inPeriod(item, period)) {
        continue;
      }
      const amount = ledger.items[item.id] ?? { amount: 0, tax: 0 };
      beforeTax += amount.amount;
      tax += amount.tax;
      const own = itemColor(site, item, options.picked);
      items.push({ item, value: amount.amount + (options.tax === "included" ? amount.tax : 0), color: own });
      const part = amount.amount + (options.tax === "none" ? 0 : amount.tax);
      if (own) {
        picked.push({ name: item.name, value: Math.max(part, 0), color: own });
      } else {
        rest += part;
      }
    }
    result.elements.push({ element, color, value: beforeTax + (options.tax === "included" ? tax : 0), items });
    result.segments.push({ name: element.name, value: Math.max(rest, 0), color }, ...picked);
    result.beforeTax += beforeTax;
    result.tax += tax;
  }
  removedItems(site, ledger, options, result);
  result.total = result.beforeTax + (options.tax === "none" ? 0 : result.tax);
  return result;
}
function removedItems(site, ledger, options, result) {
  const items = [];
  let beforeTax = 0;
  let tax = 0;
  for (const removed of site.removed ?? []) {
    const amount = ledger.items[removed.id];
    if (!amount || Math.abs(amount.amount) < 1e-9 && Math.abs(amount.tax) < 1e-9) {
      continue;
    }
    beforeTax += amount.amount;
    tax += amount.tax;
    items.push({
      item: { ...removed, element: REMOVED, kind: "removed", fee_period: null },
      value: amount.amount + (options.tax === "included" ? amount.tax : 0)
    });
  }
  if (!items.length) {
    return;
  }
  const element = { id: REMOVED, name: options.removed ?? "", tax: 0 };
  result.elements.push({ element, color: REMOVED_COLOR, value: beforeTax + (options.tax === "included" ? tax : 0), items });
  result.segments.push({ name: element.name, value: Math.max(beforeTax + (options.tax === "none" ? 0 : tax), 0), color: REMOVED_COLOR });
  result.beforeTax += beforeTax;
  result.tax += tax;
}
function listed(element, lines) {
  return lines === "all" ? element.items : lines === "picked" ? element.items.filter((item) => item.color) : [];
}
function atRate(site, days, share, feeShare) {
  const rest = add(emptyLedger(), days, share);
  for (const item of site.items) {
    const amount = days.items[item.id];
    if (item.kind === "fixed_fee" && amount) {
      const factor = item.fee_period === "day" ? feeShare : 0;
      rest.items[item.id] = { amount: amount.amount * factor, tax: amount.tax * factor };
    }
  }
  return rest;
}
function averagePrice(site, bill, consumption) {
  const metered = bill.elements.flatMap((element) => element.items).filter((item) => item.item.kind !== "fixed_fee" && item.item.kind !== "removed").reduce((sum, item) => sum + item.value, 0);
  return consumption > 0 ? metered / consumption * site.price_scale : void 0;
}

// src/data.ts
var HOUR_MS2 = 36e5;
var DAY_MS = 24 * HOUR_MS2;
var BUCKETS = { hour: "hour", day: "hour", week: "hour", month: "day", year: "day" };
var FIVE_MINUTES_MS = 3e5;
var StatisticsCache = class {
  constructor() {
    this.stamp = -1;
    this.asked = /* @__PURE__ */ new Map();
  }
  read(hass, now, ids, from, to, period, types) {
    const hour = periodStart("hour", now, hass.config?.time_zone);
    const stamp = hour / 6e4 * 2 + (now - hour >= STATISTICS_DELAY_MS ? 1 : 0);
    if (stamp !== this.stamp) {
      this.stamp = stamp;
      this.asked.clear();
    }
    const fresh = period === "5minute" ? Math.floor((now - STATISTICS_DELAY_MS) / FIVE_MINUTES_MS) : "";
    const key = [from, to, period, fresh, types.join(), ids.join()].join("|");
    let answer = this.asked.get(key);
    if (!answer) {
      answer = hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(from).toISOString(),
        end_time: new Date(to).toISOString(),
        statistic_ids: ids,
        period,
        types
      });
      this.asked.set(key, answer);
      answer.catch(() => {
        if (this.asked.get(key) === answer) {
          this.asked.delete(key);
        }
      });
    }
    return answer;
  }
  clear() {
    this.asked.clear();
  }
};
function ledgerOf(site, statistics, from, to, cut = Infinity) {
  const sum = (id) => {
    let total = 0;
    for (const row of statistics[id] ?? []) {
      if (row.start < from || row.start >= to || row.start >= cut) {
        continue;
      }
      const share = row.end > cut ? (cut - row.start) / (row.end - row.start) : 1;
      total += (row.change ?? 0) * share;
    }
    return total;
  };
  const ledger = emptyLedger();
  for (const item of [...site.items, ...site.removed ?? []]) {
    ledger.items[item.id] = { amount: sum(item.cost_statistic), tax: sum(item.tax_statistic) };
  }
  ledger.consumption = sum(site.consumption_statistic);
  return ledger;
}
function running(site, rows, before) {
  const last = (id) => rows[id]?.at(-1)?.sum ?? before[id]?.at(-1)?.sum ?? 0;
  const ledger = emptyLedger();
  for (const item of site.items) {
    const sums = site.sums[item.id] ?? { amount: 0, tax: 0 };
    ledger.items[item.id] = { amount: sums.amount - last(item.cost_statistic), tax: sums.tax - last(item.tax_statistic) };
  }
  ledger.consumption = site.consumed - last(site.consumption_statistic);
  return ledger;
}
async function line(hass, cache, site, period, from, to, now, rows, unwritten) {
  const points = (found, factor = 1) => (found ?? []).filter((row) => row.start >= from && row.start < to).map((row) => ({ start: row.start, end: Math.min(row.end, now), amount: (row.change ?? 0) * factor }));
  if (period === "day" && site.meter) {
    const read2 = await cache.read(hass, now, [site.meter.entity], from, to, "5minute", ["change"]);
    const fine = points(read2[site.meter.entity], site.meter.factor);
    if (fine.length) {
      return fine;
    }
  }
  const coarse = points(rows[site.consumption_statistic]);
  if (unwritten > 0) {
    const start = periodStart(BUCKETS[period] === "day" ? "day" : "hour", now, hass.config?.time_zone);
    const last = coarse.at(-1);
    if (last && last.start === start) {
      last.amount += unwritten;
    } else if (now - start >= FIVE_MINUTES_MS) {
      coarse.push({ start, end: now, amount: unwritten });
    }
  }
  return coarse;
}
function statisticIds(site) {
  const items = [...site.items, ...site.removed ?? []];
  return [...items.flatMap((item) => [item.cost_statistic, item.tax_statistic]), site.consumption_statistic];
}
async function loadView(hass, cache, site, period, offset, now, wants) {
  const zone = hass.config?.time_zone;
  const from = shift(period, periodStart(period, now, zone), offset, zone);
  const to = shift(period, from, 1, zone);
  const current = offset === 0;
  const since = site.since ? Date.parse(site.since) : now;
  const ids = statisticIds(site);
  const read2 = (start, end, bucket, types = ["change"]) => cache.read(hass, now, ids, start, end, bucket, types);
  const view = {
    period,
    from,
    to,
    current,
    ledger: emptyLedger(),
    elapsed: Math.min(Math.max((now - from) / (to - from), 0), 1),
    earlier: from > since
  };
  const part = PARTS[period];
  const counted = site.periods[period];
  const needsRows = !current || !counted || wants.chart && part !== void 0;
  const rows = needsRows ? await read2(from, to, BUCKETS[period], ["change", "sum"]) : {};
  const unwritten = current && needsRows ? running(site, rows, await read2(since, periodStart("hour", now, zone) + HOUR_MS2, "month", ["sum"])) : emptyLedger();
  if (current && counted) {
    view.ledger = { items: counted.items, consumption: counted.consumption };
  } else {
    view.ledger = add(ledgerOf(site, rows, from, to), unwritten);
  }
  if (wants.chart && part) {
    view.columns = [];
    const next = (start) => Math.min(shift(part, periodStart(part, start, zone), 1, zone), to);
    for (let start = from; start < to; start = next(start)) {
      const end = next(start);
      const column = {
        start,
        end,
        ledger: ledgerOf(site, rows, start, end),
        future: start > now,
        current: start <= now && now < end
      };
      if (column.current) {
        add(column.ledger, unwritten);
      }
      view.columns.push(column);
    }
    if (wants.line) {
      view.line = await line(hass, cache, site, period, from, to, now, rows, current ? unwritten.consumption : 0);
    }
  }
  if (!wants.previous) {
    return view;
  }
  const previousFrom = shift(period, from, -1, zone);
  const cut = Math.min(shift(period, now, -1, zone), from);
  const splits = current && period !== "hour";
  if (previousFrom >= since) {
    const bucket = period === "hour" || period === "day" ? "hour" : "day";
    const previous = await read2(previousFrom, from, bucket);
    view.previous = ledgerOf(site, previous, previousFrom, from);
    if (splits && bucket === "hour") {
      view.previousSame = ledgerOf(site, previous, previousFrom, from, cut);
    } else if (splits) {
      const day = periodStart("day", cut, zone);
      const hours = await read2(day, shift("day", day, 1, zone), "hour");
      view.previousSame = add(ledgerOf(site, previous, previousFrom, day), ledgerOf(site, hours, day, from, cut));
    }
  }
  if (splits && (period === "week" || period === "month")) {
    const today = periodStart("day", now, zone);
    const start = shift("day", today, -RATE_DAYS, zone);
    if (start >= since) {
      const days = ledgerOf(site, await read2(start, today, "day"), start, today);
      const toStart = Math.round((to - shift("day", today, 1, zone)) / DAY_MS);
      view.rest = atRate(site, days, (to - now) / (today - start), toStart / RATE_DAYS);
    }
  } else if (splits && cut >= since) {
    const day = periodStart("day", cut, zone);
    const next = shift("day", day, 1, zone);
    const hours = await read2(day, next, "hour");
    view.rest = add(ledgerOf(site, hours, day, next), ledgerOf(site, hours, day, next, cut), -1);
    if (next < from) {
      add(view.rest, ledgerOf(site, await read2(next, from, "day"), next, from));
    }
  }
  return view;
}

// src/fade.ts
var SCROLL_INDICATORS = ["both", "fade", "scrollbar"];
function validScrollIndicator(config) {
  return config.scroll_indicator === void 0 || config.scroll_indicator === null || SCROLL_INDICATORS.includes(config.scroll_indicator);
}
function scrollIndicator(config, fallback) {
  return config.scroll_indicator ?? fallback;
}
function scrollIndicatorSchema(text) {
  return [
    {
      name: "scroll_indicator",
      selector: {
        select: {
          mode: "dropdown",
          options: SCROLL_INDICATORS.map((value) => ({ value, label: text(`editor.scroll_indicator_${value}`) }))
        }
      }
    }
  ];
}
function scrollIndicatorData(config, fallback) {
  return { ...config, scroll_indicator: scrollIndicator(config, fallback) };
}
function tidyScrollIndicator(config, fallback) {
  const tidied = { ...config };
  if (scrollIndicator(tidied, fallback) === fallback) {
    delete tidied.scroll_indicator;
  }
  return tidied;
}
var fadeStyles = i`
    .fades {
        --fade-length: min(24px, 25%);
        scroll-padding-block: calc(var(--fade-top-offset, 0px) + var(--fade-length, 24px)) var(--fade-length, 24px);
    }

    .fade-top {
        mask-image: linear-gradient(
            to bottom,
            #000 var(--fade-top-offset, 0px),
            transparent var(--fade-top-offset, 0px),
            #000 calc(var(--fade-top-offset, 0px) + var(--fade-length, 24px))
        );
    }

    .fade-bottom {
        mask-image: linear-gradient(to top, transparent, #000 var(--fade-length, 24px));
    }

    .fade-top.fade-bottom {
        mask-image: linear-gradient(
            to bottom,
            #000 var(--fade-top-offset, 0px),
            transparent var(--fade-top-offset, 0px),
            #000 calc(var(--fade-top-offset, 0px) + var(--fade-length, 24px)),
            #000 calc(100% - var(--fade-length, 24px)),
            transparent
        );
    }

    /* Over the card's own scrollbar style, whatever its selector. */
    .scroll-hidden {
        scrollbar-width: none !important;
    }

    .scroll-hidden::-webkit-scrollbar {
        display: none;
    }
`;
function markFade(part) {
  const hidden = part.scrollHeight - part.clientHeight;
  part.classList.toggle("fade-top", hidden > 1 && part.scrollTop > 1);
  part.classList.toggle("fade-bottom", hidden > 1 && hidden - part.scrollTop > 1);
}
var onScroll = (event) => markFade(event.currentTarget);
var ScrollFade = class {
  constructor(host, parts, indicator) {
    this.host = host;
    this.parts = parts;
    this.indicator = indicator;
    /** Each followed part with the children whose size it watches. */
    this.followed = /* @__PURE__ */ new Map();
    this.resized = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver((entries) => {
      for (const { target } of entries) {
        const part = this.followed.has(target) ? target : target.parentElement;
        if (part && this.followed.has(part)) {
          markFade(part);
        }
      }
    });
    host.addController(this);
  }
  hostConnected() {
    if (this.host.hasUpdated) {
      this.follow();
    }
  }
  hostUpdated() {
    if (this.host.isConnected) {
      this.follow();
    }
  }
  hostDisconnected() {
    for (const part of [...this.followed.keys()]) {
      this.forget(part);
    }
  }
  follow() {
    const indicator = this.indicator();
    const now = new Set(indicator === "scrollbar" ? [] : this.parts());
    for (const part of [...this.followed.keys()]) {
      if (!now.has(part)) {
        this.forget(part);
      }
    }
    for (const part of now) {
      if (!this.followed.has(part)) {
        part.addEventListener("scroll", onScroll, { passive: true });
        this.resized?.observe(part);
      }
      part.classList.add("fades");
      part.classList.toggle("scroll-hidden", indicator === "fade");
      const before = this.followed.get(part) ?? [];
      const children = [...part.children];
      before.filter((child) => !children.includes(child)).forEach((child) => this.resized?.unobserve(child));
      children.filter((child) => !before.includes(child)).forEach((child) => this.resized?.observe(child));
      this.followed.set(part, children);
      markFade(part);
    }
  }
  forget(part) {
    this.followed.get(part)?.forEach((child) => this.resized?.unobserve(child));
    this.followed.delete(part);
    part.removeEventListener("scroll", onScroll);
    this.resized?.unobserve(part);
    part.classList.remove("fades", "fade-top", "fade-bottom", "scroll-hidden");
  }
};

// src/localize/languages/en.json
var en_default = {
  common: {
    name: "Utility cost",
    description: "A site's costs from the Utility cost tracker integration",
    invalid_configuration: "Invalid configuration.",
    invalid_height: "Invalid height. height and max_height must be positive numbers of pixels, and height_mode auto, fixed or max.",
    invalid_row_step: "Invalid rounding. row_step must be full or half.",
    invalid_scroll_indicator: "Invalid scroll_indicator. It must be both, fade or scrollbar.",
    invalid_period: "Invalid period. It must be hour, day, week, month or year.",
    invalid_tax: "Invalid tax. It must be included, separate or none.",
    invalid_lines: "Invalid lines. It must be all, picked or none.",
    no_site: "Choose a site in the card's settings",
    not_found: "The site wasn't found. It may have been removed, or it isn't loaded.",
    unavailable: "The site's costs are not available right now"
  },
  periods: {
    hour: "Hour",
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year"
  },
  card: {
    price_now: "Price now",
    now: "now {price}",
    today: "Today",
    yesterday: "Yesterday",
    week: "Week {number}",
    earlier: "Earlier period",
    later: "Later period",
    next_period: "Change the period",
    average: "average {price}",
    average_short: "avg. {price}",
    estimate: "Estimate for the whole period",
    estimate_short: "estimate {amount}",
    so_far: "So far",
    rest: "The rest as in the previous period",
    rest_rate: "The rest by the last {days} days' costs",
    previous_same: "The previous at the same point",
    previous_whole: "The previous whole period",
    previous: "The previous period",
    no_change: "\xB1 0 %",
    fees_not_in_bars: "Fixed fees of {amount} are not in the bars",
    before_tax: "Before tax",
    tax: "Tax",
    tax_rate: "Tax {rate} %",
    total: "Total",
    removed: "Removed items",
    used: "Consumption",
    total_before_tax: "Total before tax",
    of_which_tax: "of which tax",
    share: "Shares of the total",
    chart: "Cost over the period"
  },
  editor: {
    site: "Site",
    title: "Title",
    title_helper: "The site's name when left empty",
    period: "Period shown first",
    period_helper: "The month when left empty, or the site's longest period when it doesn't follow months",
    parts: "Parts shown",
    show_price: "Price now",
    show_periods: "Period switch",
    show_earlier: "Earlier periods",
    show_consumption: "Consumption and average price",
    show_estimate: "Estimate and the previous period",
    show_chart: "Chart",
    show_usage: "Consumption as a line in the chart",
    show_share: "Share bar",
    show_bill: "Bill",
    show_legend: "Legend, when the bill is off",
    tax: "Tax",
    tax_included: "In the prices",
    tax_separate: "On a row of its own",
    tax_none: "Left out",
    lines: "The bill's lines",
    lines_all: "All",
    lines_picked: "Only the picked ones",
    lines_none: "None",
    hidden_elements: "Hidden elements",
    hidden_elements_helper: "A hidden element is left out of the total, the chart and the estimate too",
    picked_items: "Picked lines",
    picked_items_helper: "A picked line gets a colour of its own in the legend, the bars and the share bar",
    row_step: "Rounding in a sections view",
    row_step_helper: "With automatic row height, the card's height is rounded up to whole rows, or to half rows to save space.",
    row_step_full: "Whole rows",
    row_step_half: "Half rows",
    scroll_indicator: "Scrolling",
    scroll_indicator_helper: "Shown when the card's height is limited and its content doesn't all fit",
    scroll_indicator_both: "Faded edge and scrollbar",
    scroll_indicator_fade: "Faded edge",
    scroll_indicator_scrollbar: "Scrollbar"
  }
};

// src/localize/languages/fi.json
var fi_default = {
  common: {
    name: "K\xE4ytt\xF6kulut",
    description: "Kohteen kulut Utility cost tracker -integraatiosta",
    invalid_configuration: "Virheellinen m\xE4\xE4ritys.",
    invalid_height: "Virheellinen korkeus. Korkeuksien (height ja max_height) on oltava positiivisia lukuja pikselein\xE4, ja korkeustilan (height_mode) auto, fixed tai max.",
    invalid_row_step: "Virheellinen py\xF6ristys. Py\xF6ristyksen (row_step) on oltava full tai half.",
    invalid_scroll_indicator: "Virheellinen scroll_indicator. Sen on oltava both, fade tai scrollbar.",
    invalid_period: "Virheellinen period. Sen on oltava hour, day, week, month tai year.",
    invalid_tax: "Virheellinen tax. Sen on oltava included, separate tai none.",
    invalid_lines: "Virheellinen lines. Sen on oltava all, picked tai none.",
    no_site: "Valitse kohde kortin asetuksista",
    not_found: "Kohdetta ei l\xF6ytynyt. Se on ehk\xE4 poistettu, tai sit\xE4 ei ole ladattu.",
    unavailable: "Kohteen kulut eiv\xE4t ole juuri nyt saatavilla"
  },
  periods: {
    hour: "Tunti",
    day: "P\xE4iv\xE4",
    week: "Viikko",
    month: "Kuukausi",
    year: "Vuosi"
  },
  card: {
    price_now: "Hinta nyt",
    now: "nyt {price}",
    today: "T\xE4n\xE4\xE4n",
    yesterday: "Eilen",
    week: "Viikko {number}",
    earlier: "Aiempi jakso",
    later: "My\xF6hempi jakso",
    next_period: "Vaihda jaksoa",
    average: "keskim\xE4\xE4rin {price}",
    average_short: "ka. {price}",
    estimate: "Arvio koko jaksolle",
    estimate_short: "arvio {amount}",
    so_far: "T\xE4h\xE4n asti",
    rest: "Loppu kuten edellisess\xE4 jaksossa",
    rest_rate: "Loppuosa viimeisen {days} p\xE4iv\xE4n kulujen perusteella",
    previous_same: "Edellinen samaan aikaan",
    previous_whole: "Edellinen koko jakso",
    previous: "Edellinen jakso",
    no_change: "\xB1 0 %",
    fees_not_in_bars: "Kiinte\xE4t maksut {amount} eiv\xE4t ole pylv\xE4iss\xE4",
    before_tax: "Veroton",
    tax: "Vero",
    tax_rate: "Vero {rate} %",
    total: "Yhteens\xE4",
    removed: "Poistetut rivit",
    used: "Kulutus",
    total_before_tax: "Yhteens\xE4, veroton",
    of_which_tax: "josta veroa",
    share: "Osuudet summasta",
    chart: "Kulut jakson aikana"
  },
  editor: {
    site: "Kohde",
    title: "Otsikko",
    title_helper: "Tyhj\xE4n\xE4 kohteen nimi",
    period: "Ensin n\xE4ytett\xE4v\xE4 jakso",
    period_helper: "Tyhj\xE4n\xE4 kuukausi, tai kohteen pisin jakso, jos se ei seuraa kuukausia",
    parts: "N\xE4ytett\xE4v\xE4t osat",
    show_price: "Hinta nyt",
    show_periods: "Jakson valinta",
    show_earlier: "Aiemmat jaksot",
    show_consumption: "Kulutus ja keskihinta",
    show_estimate: "Arvio ja edellinen jakso",
    show_chart: "Kaavio",
    show_usage: "Kulutus viivana kaaviossa",
    show_share: "Osuuspalkki",
    show_bill: "Lasku",
    show_legend: "Selite, kun lasku ei ole n\xE4kyviss\xE4",
    tax: "Verot",
    tax_included: "Hinnoissa",
    tax_separate: "Omalla rivill\xE4\xE4n",
    tax_none: "Ei veroja",
    lines: "Laskun rivit",
    lines_all: "Kaikki",
    lines_picked: "Vain eritellyt",
    lines_none: "Ei rivej\xE4",
    hidden_elements: "Piilotetut osat",
    hidden_elements_helper: "Piilotettu osa j\xE4\xE4 pois my\xF6s summasta, kaaviosta ja arviosta",
    picked_items: "Eritellyt rivit",
    picked_items_helper: "Eritelty rivi saa oman v\xE4rins\xE4 selitteeseen, pylv\xE4isiin ja osuuspalkkiin",
    row_step: "Py\xF6ristys osioihin jaetussa n\xE4kym\xE4ss\xE4",
    row_step_helper: "Automaattisella rivikorkeudella kortin korkeus py\xF6ristet\xE4\xE4n yl\xF6sp\xE4in kokonaisiin riveihin, tai tilan s\xE4\xE4st\xE4miseksi puolikkaisiin riveihin.",
    row_step_full: "Kokonaisiin riveihin",
    row_step_half: "Puolikkaisiin riveihin",
    scroll_indicator: "Vieritys",
    scroll_indicator_helper: "N\xE4kyy, kun kortin korkeus on rajattu eik\xE4 koko sis\xE4lt\xF6 mahdu siihen",
    scroll_indicator_both: "H\xE4ivytetty reuna ja vierityspalkki",
    scroll_indicator_fade: "H\xE4ivytetty reuna",
    scroll_indicator_scrollbar: "Vierityspalkki"
  }
};

// src/localize/localize.ts
var FILES = { "./languages/en.json": en_default, "./languages/fi.json": fi_default };
var LANGUAGES = Object.fromEntries(
  Object.entries(FILES).map(([path, table]) => [path.replace(/^.*\/|\.json$/g, "").toLowerCase(), table])
);
var LANGUAGE_CODES = Object.keys(LANGUAGES).sort();
function translate(language, key) {
  for (const code of languageCodes(language)) {
    const text = read(LANGUAGES[code], key);
    if (text !== void 0) {
      return text;
    }
  }
  return read(LANGUAGES.en, key) ?? key;
}
function languageCodes(language) {
  const tag = (language ?? "en").trim().toLowerCase().replace(/_/g, "-");
  const base = tag.split("-")[0];
  return tag === base ? [base] : [tag, base];
}
function read(table, key) {
  let value = table;
  for (const part of key.split(".")) {
    if (value === null || typeof value !== "object") {
      return void 0;
    }
    value = value[part];
  }
  return typeof value === "string" ? value : void 0;
}
function browserLanguage() {
  return document.documentElement.lang || navigator.language || "en";
}

// src/height.ts
var HEIGHT_MODES = ["auto", "fixed", "max"];
var pixels = (value) => value == null || typeof value === "number" && Number.isFinite(value) && value > 0;
function validHeight(config) {
  return (config.height_mode == null || HEIGHT_MODES.includes(config.height_mode)) && pixels(config.height) && pixels(config.max_height);
}
function heightMode(config) {
  return config.height_mode ?? (config.height ? "fixed" : config.max_height ? "max" : "auto");
}
var ROW_HEIGHT = 56;
var ROW_GAP = 8;
function heightStyle(config, layout, minimum = 0) {
  const rows = config.grid_options ? config.grid_options.rows : config.layout_options?.grid_rows;
  if (layout === "grid" && typeof rows === "number") {
    return "height: 100%";
  }
  const mode = heightMode(config);
  if (mode === "fixed" && config.height) {
    return `height: ${Math.max(config.height, minimum)}px`;
  }
  return mode === "max" && config.max_height ? `max-height: ${Math.max(config.max_height, minimum)}px` : "";
}
function gridMinRows(minimum) {
  return Math.max(1, Math.ceil((minimum + ROW_GAP) / (ROW_HEIGHT + ROW_GAP)));
}
function heightCardSize(config, content, minimum = 0) {
  const mode = heightMode(config);
  if (mode === "fixed" && config.height) {
    return Math.max(1, Math.round(Math.max(config.height, minimum) / 50));
  }
  return mode === "max" && config.max_height ? Math.max(1, Math.min(content, Math.round(Math.max(config.max_height, minimum) / 50))) : content;
}

// src/rows.ts
var ROW_STEPS = ["full", "half"];
var ROW_PX = 64;
var ROW_GAP_PX = 8;
function validRowStep(config) {
  return config.row_step === void 0 || config.row_step === null || ROW_STEPS.includes(config.row_step);
}
var step = (config) => config.row_step === "half" ? ROW_PX / 2 : ROW_PX;
var SLACK_PX = 0.01;
function drawnScale(card) {
  const layout = Number.parseFloat(getComputedStyle(card).width) || 0;
  const drawn = card.getBoundingClientRect().width;
  return layout > 0 && drawn > 0 ? drawn / layout : 1;
}
function filledHeight(content, config, limit = Infinity) {
  return Math.min(Math.max(1, Math.ceil((content - SLACK_PX + ROW_GAP_PX) / step(config))) * step(config) - ROW_GAP_PX, limit);
}
function spareRoom(filled, content) {
  return Math.max(0, Math.floor(filled - content + SLACK_PX));
}
function fillLimit(config, layout, minimum = 0) {
  const rows = config.grid_options ? config.grid_options.rows : config.layout_options?.grid_rows;
  if (layout !== "grid" || typeof rows === "number") {
    return 0;
  }
  const mode = heightMode(config);
  if (mode === "fixed" && config.height) {
    return 0;
  }
  if (mode !== "max" || !config.max_height) {
    return Infinity;
  }
  const down = Math.floor((config.max_height + ROW_GAP_PX) / step(config)) * step(config) - ROW_GAP_PX;
  return Math.max(down, filledHeight(minimum, config));
}
function filledStyle(config, layout, minimum, filled) {
  const limit = fillLimit(config, layout, minimum);
  if (!limit) {
    return heightStyle(config, layout, minimum);
  }
  return [limit < Infinity && `max-height: ${limit}px`, filled && `min-height: ${filled}px`].filter(Boolean).join("; ");
}
function rowStepSchema(config, text) {
  if (heightMode(config) === "fixed" && config.height) {
    return [];
  }
  return [
    {
      name: "row_step",
      selector: {
        select: { mode: "dropdown", options: ROW_STEPS.map((value) => ({ value, label: text(`editor.row_step_${value}`) })) }
      }
    }
  ];
}
function rowStepData(config) {
  return { ...config, row_step: config.row_step ?? "full" };
}
function tidyRowStep(config) {
  const tidied = { ...config };
  if (tidied.row_step !== "half" || heightMode(tidied) === "fixed" && tidied.height) {
    delete tidied.row_step;
  }
  return tidied;
}

// src/types.ts
var TAX_MODES = ["included", "separate", "none"];
var LINES = ["all", "picked", "none"];
var PARTS_SHOWN = {
  show_price: true,
  show_periods: true,
  show_earlier: true,
  show_consumption: true,
  show_estimate: true,
  show_chart: true,
  show_usage: true,
  show_share: false,
  show_bill: true,
  show_legend: true
};
function shows(config, part) {
  return config?.[part] ?? PARTS_SHOWN[part];
}

// src/editor.ts
var DEFAULTS = { ...PARTS_SHOWN, tax: "included", lines: "all" };
function schema(site, config, text) {
  const select = (name, values, prefix) => ({
    name,
    selector: { select: { mode: "dropdown", options: values.map((value) => ({ value, label: text(`${prefix}${value}`) })) } }
  });
  const elementName = (id) => site?.elements.find((element) => element.id === id)?.name ?? "";
  return [
    { name: "site", required: true, selector: { config_entry: { integration: DOMAIN } } },
    { name: "title", selector: { text: {} } },
    select("period", site ? PERIODS.filter((period) => site.periods[period]) : PERIODS, "periods."),
    {
      name: "parts",
      type: "expandable",
      flatten: true,
      title: text("editor.parts"),
      schema: Object.keys(PARTS_SHOWN).map((name) => ({ name, selector: { boolean: {} } }))
    },
    select("tax", TAX_MODES, "editor.tax_"),
    // The bill's own setting, which a card without the bill has no use for.
    ...shows(config, "show_bill") ? [select("lines", LINES, "editor.lines_")] : [],
    // Named by the site, so they are offered once the site has been read.
    ...site ? [
      {
        name: "hidden_elements",
        selector: {
          select: { multiple: true, options: site.elements.map((element) => ({ value: element.id, label: element.name })) }
        }
      },
      {
        name: "picked_items",
        selector: {
          select: {
            multiple: true,
            options: site.items.map((item) => ({
              value: item.id,
              label: site.elements.length > 1 ? `${elementName(item.element)} \xB7 ${item.name}` : item.name
            }))
          }
        }
      }
    ] : [],
    ...rowStepSchema(config, text),
    ...scrollIndicatorSchema(text)
  ];
}
var UtilityCostCardEditor = class extends i4 {
  constructor() {
    super(...arguments);
    this.config = { type: "custom:utility-cost-card" };
  }
  setConfig(config) {
    this.config = { ...config };
  }
  willUpdate(changed) {
    if (changed.has("config") || changed.has("hass")) {
      this.readSite();
    }
  }
  render() {
    if (!this.hass) {
      return A;
    }
    return b2`
            <ha-form
                .hass=${this.hass}
                .data=${{ ...DEFAULTS, ...scrollIndicatorData(rowStepData(this.config), DEFAULT_SCROLL_INDICATOR) }}
                .schema=${schema(this.site, this.config, (key) => this.text(key))}
                .computeLabel=${(entry) => this.text(`editor.${entry.name}`)}
                .computeHelper=${(entry) => this.helper(entry.name)}
                @value-changed=${this.valueChanged}
            ></ha-form>
        `;
  }
  /** The site's elements and items, for the lists of the ones to hide and to pick. */
  readSite() {
    const entry = this.config.site;
    if (!this.hass?.callWS || entry === this.asked) {
      return;
    }
    this.asked = entry;
    this.site = void 0;
    if (!entry) {
      return;
    }
    this.hass.callWS({ type: `${DOMAIN}/site`, entry_id: entry }).then((site) => {
      if (this.asked === entry) {
        this.site = site;
      }
    }).catch(() => {
    });
  }
  valueChanged(event) {
    const config = tidyScrollIndicator(tidyRowStep(event.detail.value), DEFAULT_SCROLL_INDICATOR);
    if (config.site !== this.config.site) {
      delete config.hidden_elements;
      delete config.picked_items;
    }
    for (const key of ["title", "period", "site"]) {
      if (!config[key]) {
        delete config[key];
      }
    }
    for (const key of ["hidden_elements", "picked_items"]) {
      if (!config[key]?.length) {
        delete config[key];
      }
    }
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (config[key] === value || config[key] === void 0 || config[key] === null) {
        delete config[key];
      }
    }
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  text(key) {
    return translate(this.language(), key);
  }
  helper(name) {
    const key = `editor.${name}_helper`;
    const helper = translate(this.language(), key);
    return helper === key ? void 0 : helper;
  }
  language() {
    return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
  }
};
__decorateClass([
  n4({ attribute: false })
], UtilityCostCardEditor.prototype, "hass", 2);
__decorateClass([
  r5()
], UtilityCostCardEditor.prototype, "config", 2);
__decorateClass([
  r5()
], UtilityCostCardEditor.prototype, "site", 2);
if (!customElements.get("utility-cost-card-editor")) {
  customElements.define("utility-cost-card-editor", UtilityCostCardEditor);
}

// src/utility-cost-card.ts
var HOUR_MS3 = 36e5;
var DENSE_FROM = 40;
function niceUp(value) {
  if (!(value > 0)) {
    return 0;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const lead = value / power;
  return (lead <= 1.000001 ? 1 : lead <= 2.000001 ? 2 : lead <= 2.500001 ? 2.5 : lead <= 5.000001 ? 5 : 10) * power;
}
function decimals(step2) {
  if (!(step2 > 0)) {
    return 0;
  }
  const power = Math.floor(Math.log10(step2));
  const half = Math.abs(step2 / 10 ** power - 2.5) < 1e-3 ? 1 : 0;
  return Math.min(Math.max(-power + half, 0), 6);
}
function scale(value) {
  const step2 = niceUp(value / 3);
  return { step: step2, steps: step2 ? Math.max(Math.ceil(value / step2 - 1e-9), 2) : 2 };
}
var PADDING = 16;
var GAP = 12;
var HEADER_HEIGHT = 24;
var COMPACT_HEIGHT = 40;
var COMPACT_NARROW_HEIGHT = 60;
var PERIODS_HEIGHT = 28;
var EARLIER_HEIGHT = 36;
var LABEL_HEIGHT = 18;
var TOTAL_HEIGHT = 40;
var CONSUMPTION_HEIGHT = 18;
var ESTIMATE_HEIGHT = 118;
var ESTIMATE_LINE_HEIGHT = 16;
var SHARE_HEIGHT = 10;
var CHART_HEIGHT = 120;
var CHART_PART_HEIGHT = CHART_HEIGHT + 18 + 16;
var CHART_LEAST_HEIGHT = 76;
var LEGEND_HEIGHT = 20;
var LIST_HEIGHT = 48;
var UtilityCostCard = class extends i4 {
  constructor() {
    super();
    this.offset = 0;
    this.filled = 0;
    this.topped = false;
    this.statistics = new StatisticsCache();
    /** Counts the reads started, so an answer that a later read has overtaken is dropped. */
    this.reads = 0;
    this.resizes = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(() => this.measureSoon());
    new ScrollFade(
      this,
      () => this.held() ? [...this.renderRoot.querySelectorAll(".list")] : [],
      () => scrollIndicator(this.config ?? {}, DEFAULT_SCROLL_INDICATOR)
    );
  }
  static getConfigElement() {
    return document.createElement("utility-cost-card-editor");
  }
  /** The first site there is, so the card picker's preview shows a bill. */
  static async getStubConfig(hass) {
    try {
      const entries = await hass?.callWS?.({ type: "config_entries/get", domain: DOMAIN });
      return entries?.length ? { site: entries[0].entry_id } : {};
    } catch {
      return {};
    }
  }
  setConfig(config) {
    const fail = (key) => new Error(translate(browserLanguage(), `common.${key}`));
    if (!config) {
      throw fail("invalid_configuration");
    }
    if (!validHeight(config)) {
      throw fail("invalid_height");
    }
    if (!validRowStep(config)) {
      throw fail("invalid_row_step");
    }
    if (!validScrollIndicator(config)) {
      throw fail("invalid_scroll_indicator");
    }
    if (config.period != null && !PERIODS.includes(config.period)) {
      throw fail("invalid_period");
    }
    if (config.tax != null && !TAX_MODES.includes(config.tax)) {
      throw fail("invalid_tax");
    }
    if (config.lines != null && !LINES.includes(config.lines)) {
      throw fail("invalid_lines");
    }
    if (config.site !== this.config?.site) {
      this.site = void 0;
      this.view = void 0;
      this.failed = void 0;
      this.picked = void 0;
      this.offset = 0;
      this.statistics.clear();
    }
    this.config = config;
  }
  /** In units of 50 px, for a masonry view. */
  getCardSize() {
    return heightCardSize(this.config ?? {}, Math.ceil(this.minimumHeight() / 50), this.minimumHeight());
  }
  /** The chart's bars and the bill's amounts need about a phone's section, so the card takes a whole section. */
  getGridOptions() {
    return { columns: 12, min_columns: this.narrowable() ? 6 : 12, rows: "auto", min_rows: gridMinRows(this.minimumHeight()) };
  }
  /** Whether the card fits in half a section: with the one-row head and neither a chart nor a bill, which need the width. */
  narrowable() {
    const config = this.config;
    const full = shows(config, "show_periods") || shows(config, "show_earlier");
    return !full && !shows(config, "show_chart") && !shows(config, "show_bill");
  }
  /** The columns the card has in a sections view: 12, a whole section, unless the layout tab gave it fewer. */
  columns() {
    const config = this.config;
    const columns = config?.grid_options ? config.grid_options.columns : config?.layout_options?.grid_columns;
    const older = !config?.grid_options;
    return typeof columns === "number" ? columns * (older ? 3 : 1) : 12;
  }
  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => void this.read(), REFRESH_MS);
    if (this.hasUpdated) {
      void this.read();
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.resizes?.disconnect();
    cancelAnimationFrame(this.frame ?? 0);
  }
  /** Home Assistant hands over a new `hass` on every state change, none of which the card reads. */
  shouldUpdate(changed) {
    if (changed.size > 1 || !changed.has("hass")) {
      return true;
    }
    const before = changed.get("hass");
    return !before || this.language(before) !== this.language() || before.config?.time_zone !== this.hass?.config?.time_zone;
  }
  willUpdate(changed) {
    if (changed.has("config") || changed.has("picked") || changed.has("offset") || changed.has("hass") && !changed.get("hass")) {
      void this.read();
    }
  }
  render() {
    if (!this.hass || !this.config) {
      return A;
    }
    const message = !this.config.site ? "no_site" : this.failed ?? (this.site && this.view ? void 0 : "");
    if (message !== void 0) {
      return b2`<ha-card class=${this.cardClass()} style=${this.cardStyle()}
                ><div class="content"><div class="part message">${message ? this.text(`common.${message}`) : A}</div></div></ha-card
            >`;
    }
    const site = this.site;
    const view = this.view;
    const config = this.config;
    const bill = shown(site, view.ledger, view.period, this.options());
    const full = shows(config, "show_periods") || shows(config, "show_earlier");
    return b2`
            <ha-card class=${this.cardClass()} style=${this.cardStyle()}>
                <div class="content">
                    ${full ? this.header(site, view, bill) : this.compact(site, view, bill)}
                    ${full && shows(config, "show_estimate") && this.boxed() ? this.estimate(site, view, bill) : A}
                    ${shows(config, "show_share") ? this.share(site, bill) : A}
                    ${shows(config, "show_chart") ? this.chart(site, view, bill) : A}
                    ${shows(config, "show_bill") ? this.bill(site, bill) : shows(config, "show_legend") ? this.legend(site, bill) : A}
                </div>
            </ha-card>
        `;
  }
  updated() {
    const card = this.renderRoot.querySelector("ha-card");
    if (card && this.isConnected) {
      this.resizes?.observe(card);
      this.measureSoon();
    }
  }
  /** Reads the site, and the period shown with what the options need of its history. */
  async read() {
    const hass = this.hass;
    const entry = this.config?.site;
    if (!hass?.callWS || !entry || !this.isConnected) {
      return;
    }
    const read2 = ++this.reads;
    try {
      const site = await hass.callWS({ type: `${DOMAIN}/site`, entry_id: entry });
      const period = this.periodOf(site);
      const wants = {
        chart: shows(this.config, "show_chart"),
        previous: shows(this.config, "show_estimate"),
        line: shows(this.config, "show_usage")
      };
      const view = period ? await loadView(hass, this.statistics, site, period, this.offset, Date.now(), wants) : void 0;
      if (read2 !== this.reads) {
        return;
      }
      this.site = site;
      this.view = view;
      this.failed = view ? void 0 : "unavailable";
    } catch (error) {
      if (read2 !== this.reads) {
        return;
      }
      const missing = error?.code === "not_found";
      if (missing || !this.site) {
        this.failed = missing ? "not_found" : "unavailable";
      }
    }
  }
  /** The periods the site follows, shortest first. */
  followed(site) {
    return PERIODS.filter((period) => site.periods[period]);
  }
  /** The period picked in the card, else the configured one, else the month, else the site's longest. */
  periodOf(site) {
    const followed = this.followed(site);
    return [this.picked, this.config?.period, "month"].find((period) => period && followed.includes(period)) ?? followed.at(-1);
  }
  options() {
    return {
      tax: this.config?.tax ?? "included",
      hidden: this.config?.hidden_elements ?? [],
      picked: this.config?.picked_items ?? [],
      removed: this.text("card.removed")
    };
  }
  pick(period) {
    this.picked = period;
    this.offset = 0;
  }
  header(site, view, bill) {
    const config = this.config;
    const price = site.prices.total;
    const [label, detail] = this.label(view);
    const followed = this.followed(site);
    return b2`
            <div class="part header">
                <ha-icon .icon=${ICONS[site.utility ?? ""] ?? ICONS.other}></ha-icon>
                <span class="name" title=${this.heading(site)}>${this.heading(site)}</span>
                ${shows(config, "show_price") && price != null ? b2`<span class="price"
                              ><span class="price-label">${this.text("card.price_now")} </span><b>${this.price(site, price)}</b></span
                          >` : A}
            </div>
            ${shows(config, "show_periods") && followed.length > 1 ? b2`<div class="part periods" role="group">
                          ${followed.map(
      (period) => b2`<button
                                      type="button"
                                      class=${period === view.period ? "on" : ""}
                                      aria-pressed=${period === view.period}
                                      @click=${() => this.pick(period)}
                                  >
                                      ${this.text(`periods.${period}`)}
                                  </button>`
    )}
                      </div>` : A}
            ${shows(config, "show_earlier") ? b2`<div class="part earlier">
                          <button
                              type="button"
                              ?disabled=${!view.earlier}
                              title=${this.text("card.earlier")}
                              aria-label=${this.text("card.earlier")}
                              @click=${() => this.offset -= 1}
                          >
                              <ha-icon icon="mdi:chevron-left"></ha-icon>
                          </button>
                          <div class="label">${label}<small>${detail}</small></div>
                          <button
                              type="button"
                              ?disabled=${view.current}
                              title=${this.text("card.later")}
                              aria-label=${this.text("card.later")}
                              @click=${() => this.offset += 1}
                          >
                              <ha-icon icon="mdi:chevron-right"></ha-icon>
                          </button>
                      </div>` : b2`<div class="part plain-label">${label}</div>`}
            <div class="part amount">
                <div class="total">${this.money(site, bill.total)}</div>
                ${shows(config, "show_consumption") ? b2`<div class="consumption">${this.consumption(site, view, bill)}</div>` : A}
                ${shows(config, "show_estimate") && !this.boxed() ? this.estimateLine(site, view, bill) : A}
            </div>
        `;
  }
  /** Without the period switch and the earlier periods, the whole head is one row, and a tap on the period changes it. */
  compact(site, view, bill) {
    const config = this.config;
    const followed = this.followed(site);
    const next = followed[(followed.indexOf(view.period) + 1) % followed.length];
    const guess = shows(config, "show_estimate") ? this.estimated(site, view, bill) : void 0;
    const averages = shows(config, "show_consumption");
    const short = (value) => averages && value !== void 0 ? this.text("card.average_short").replace("{price}", this.price(site, value)) : void 0;
    const average = short(averagePrice(site, bill, view.ledger.consumption));
    const [nowBefore, nowAfter] = this.text("card.now").split("{price}");
    const price = shows(config, "show_price") ? site.prices.total : void 0;
    const now = price == null ? void 0 : b2`${nowBefore}${this.number(price, 2)}<span class="unit"> ${site.price_unit}</span>${nowAfter}`;
    const said = price == null ? void 0 : `${nowBefore}${this.price(site, price)}${nowAfter}`;
    const [before, after] = this.text("card.estimate_short").split("{amount}");
    const [label, , brief] = this.label(view);
    const period = brief ? b2`<span class="long">${label}</span><span class="brief">${brief}</span>` : label;
    return b2`<div class="part compact">
            <div class="badge"><ha-icon .icon=${ICONS[site.utility ?? ""] ?? ICONS.other}></ha-icon></div>
            <div class="names">
                <b title=${this.heading(site)}>${this.heading(site)}</b>
                ${followed.length > 1 ? b2`<button type="button" class="period" title=${this.text("card.next_period")} @click=${() => this.pick(next)}>
                              ${period} <ha-icon icon="mdi:swap-horizontal"></ha-icon>
                          </button>` : b2`<span class="period">${period}</span>`}
            </div>
            ${guess ? b2`<div class="guess">
                          <span>${before}<b>${this.money(site, guess.total, 0)}</b>${after}</span>
                          <small>${short(this.estimatedAverage(site, view)) ?? A}</small>
                      </div>` : A}
            <div class="value">
                ${this.money(site, bill.total)}
                <small title=${[average, said].filter(Boolean).join(" \xB7 ")}
                    >${average ? b2`<span>${average}</span>` : A}${now ? b2`<span class="now">${now}</span>` : A}</small
                >
            </div>
        </div>`;
  }
  /** The average price of the whole period as estimated: this one so far and the rest as estimated. */
  estimatedAverage(site, view) {
    const whole = add(add(emptyLedger(), view.ledger), view.rest);
    return averagePrice(site, shown(site, whole, view.period, this.options()), whole.consumption);
  }
  /**
   * What the one-row head gives up when its texts don't fit: first the estimate, then the period's long name for its
   * brief one. The price now goes by itself, wrapped onto a line that isn't shown.
   */
  fitHead() {
    const head = this.renderRoot.querySelector(".compact");
    const name = head?.querySelector(".names b");
    const period = head?.querySelector(".period");
    if (!head || !name || !period) {
      return;
    }
    head.classList.remove("no-guess", "brief-period");
    const cut = (element) => element.scrollWidth > element.clientWidth;
    const now = head.querySelector(".now");
    const average = now?.previousElementSibling;
    if (cut(name) || cut(period) || now && average && now.offsetTop > average.offsetTop) {
      head.classList.add("no-guess");
    }
    const shared = getComputedStyle(period.parentElement).flexDirection === "row";
    if (cut(period) || shared && cut(name)) {
      head.classList.add("brief-period");
    }
  }
  consumption(site, view, bill) {
    const used = view.ledger.consumption;
    const average = averagePrice(site, bill, used);
    return b2`<b>${this.number(used, used < 10 ? 2 : 1)}${site.unit ? ` ${site.unit}` : ""}</b>${average === void 0 ? A : b2` · ${this.text("card.average").replace("{price}", "")}<b>${this.price(site, average)}</b>`}`;
  }
  /** The whole period's estimate, when this is the current period and the history has what its rest is counted from. */
  estimated(site, view, bill) {
    if (!view.rest) {
      return void 0;
    }
    const rest = shown(site, view.rest, view.period, this.options()).total;
    return { rest, total: bill.total + rest };
  }
  estimate(site, view, bill) {
    const row = (label, value, strong = false) => b2`<div class="row">
                <span class="row-label" title=${label}>${label}</span>${strong ? b2`<b>${value}</b>` : b2`<span>${value}</span>`}
            </div>`;
    const previous = view.previous && shown(site, view.previous, view.period, this.options()).total;
    const guess = this.estimated(site, view, bill);
    if (!guess) {
      return previous === void 0 ? A : b2`<div class="part estimate">
                      ${row(
        this.text("card.previous"),
        b2`${this.money(site, previous)} ${view.current ? A : this.change(bill.total, previous)}`
      )}
                  </div>`;
    }
    const rated = view.period === "week" || view.period === "month";
    const rest = rated ? this.text("card.rest_rate").replace("{days}", String(RATE_DAYS)) : this.text("card.rest");
    const same = view.previousSame && shown(site, view.previousSame, view.period, this.options()).total;
    return b2`<div class="part estimate">
            ${row(this.text("card.estimate"), this.money(site, guess.total), true)}
            <div class="progress"><i style="width: ${view.elapsed * 100}%"></i></div>
            ${row(this.text("card.so_far"), this.money(site, bill.total))} ${row(rest, `+ ${this.money(site, guess.rest)}`)}
            ${previous === void 0 || same === void 0 ? A : b2`${row(this.text("card.previous_same"), b2`${this.money(site, same)} ${this.change(bill.total, same)}`)}
                      ${row(this.text("card.previous_whole"), this.money(site, previous))}`}
        </div>`;
  }
  /** The estimate as a line under the total, for a card held too low for the estimate's box. */
  estimateLine(site, view, bill) {
    const guess = this.estimated(site, view, bill);
    if (guess) {
      return b2`<div class="estimate-line">${this.text("card.estimate")} <b>${this.money(site, guess.total)}</b></div>`;
    }
    if (!view.previous) {
      return A;
    }
    const previous = shown(site, view.previous, view.period, this.options()).total;
    return b2`<div class="estimate-line">
            ${this.text("card.previous")} <b>${this.money(site, previous)}</b> ${view.current ? A : this.change(bill.total, previous)}
        </div>`;
  }
  /** How much more or less `value` is than `against`, in percent. */
  change(value, against) {
    const percent = (value / against - 1) * 100;
    if (!Number.isFinite(percent) || Math.abs(percent) < 0.5) {
      return b2`<span class="change">${this.text("card.no_change")}</span>`;
    }
    return b2`<span class="change ${percent > 0 ? "up" : "down"}"
            >${percent > 0 ? "\u25B2" : "\u25BC"} ${this.number(Math.abs(percent), 0)} %</span
        >`;
  }
  segments(site, segments, total, along, titled = true) {
    return segments.filter((segment) => segment.value > 0).map(
      (segment) => b2`<i
                        title=${titled ? `${segment.name} ${this.money(site, segment.value)}` : A}
                        style="${along}: ${segment.value / total * 100}%; background: ${segment.color}"
                    ></i>`
    );
  }
  share(site, bill) {
    const segments = bill.segments.filter((segment) => segment.value > 0);
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
    const side = (event) => {
      if (event.pointerType === "touch") {
        return;
      }
      const bar = event.currentTarget.getBoundingClientRect();
      this.sharing = event.clientX - bar.left < bar.width / 2 ? "left" : "right";
    };
    return b2`<div class="part share" @pointermove=${side} @pointerleave=${() => this.sharing = void 0}>
            <div class="share-bar" role="img" aria-label=${this.text("card.share")}>
                ${this.segments(site, segments, total, "width", false)}
            </div>
            ${this.sharing ? b2`<div class="tip" style="${this.sharing}: 0" aria-hidden="true">
                          ${segments.map(
      (segment) => b2`<span
                                      ><span><i class="dot" style="background: ${segment.color}"></i>${segment.name}</span
                                      ><span
                                          >${this.money(site, segment.value)} · ${this.number(segment.value / total * 100, 0)} %</span
                                      ></span
                                  >`
    )}
                          <span><span>${this.text("card.total")}</span><b>${this.money(site, bill.total)}</b></span>
                      </div>` : A}
        </div>`;
  }
  chart(site, view, bill) {
    const part = PARTS[view.period];
    if (!view.columns || !part) {
      return A;
    }
    const options = this.options();
    const columns = view.columns.map((column) => ({ column, bill: shown(site, column.ledger, part, options) }));
    const top = Math.max(...columns.map((column) => column.bill.segments.reduce((sum, segment) => sum + segment.value, 0)), 0);
    const fees = bill.elements.flatMap((element) => element.items).filter((item) => !inPeriod(item.item, part)).reduce((sum, item) => sum + item.value, 0);
    const digits = top > 0 && top < 0.05 ? 3 : 2;
    const rates = (view.line ?? []).filter((point) => point.end > point.start).map((point) => ({ at: (point.start + point.end) / 2, rate: point.amount * HOUR_MS3 / (point.end - point.start) }));
    const most = Math.max(...rates.map((point) => point.rate), 0);
    const opens = Boolean(site.periods[part]) && (shows(this.config, "show_periods") || !shows(this.config, "show_earlier"));
    const hovered = this.hovered === void 0 ? void 0 : columns[this.hovered];
    const cost = scale(top);
    const rate = { step: niceUp(most / cost.steps), steps: cost.steps };
    const ticks = Array.from({ length: cost.steps }, (_2, index) => cost.steps - index);
    const costTop = cost.step * cost.steps || 1;
    const rateTop = rate.step * rate.steps || 1;
    const currency = new Intl.NumberFormat(this.language(), { style: "currency", currency: site.currency }).formatToParts(0).find((piece) => piece.type === "currency")?.value ?? site.currency;
    const side = (unit, step2, kind) => b2`<div class="scale ${kind}" aria-hidden="true">
                <span class="unit">${unit}</span>
                ${step2 ? ticks.map((tick) => b2`<span style="bottom: ${tick / cost.steps * 100}%">${this.number(tick * step2, 0, decimals(step2))}</span>`) : A}
            </div>`;
    const dense = columns.length > DENSE_FROM;
    const gap = dense ? 1 : 2;
    return b2`<div class="part chart ${most > 0 ? "lined" : ""}">
            <div class="plot">
                ${side(currency, cost.step, "cost")}
                <div
                    class="bars ${dense ? "dense" : ""}"
                    role="group"
                    aria-label=${this.text("card.chart")}
                    @pointermove=${(event) => this.hover(event, columns.length)}
                    @pointerleave=${() => this.hovered = void 0}
                >
                    ${ticks.map((tick) => b2`<i class="grid" style="bottom: ${tick / cost.steps * 100}%"></i>`)}
                    ${columns.map(({ column, bill: columnBill }) => {
      const label = `${this.columnLabel(part, column)} ${this.money(site, columnBill.total, digits)}`;
      const bars = column.future ? A : this.segments(site, columnBill.segments, costTop, "height", false);
      return opens && !column.future ? b2`<button
                                  type="button"
                                  class="column ${column.current ? "current" : ""}"
                                  aria-label=${label}
                                  @click=${() => this.open(part, column.start)}
                              >
                                  ${bars}
                              </button>` : b2`<div class="column ${column.current ? "current" : ""}" role="img" aria-label=${label}>${bars}</div>`;
    })}
                    ${most > 0 ? b2`<svg
                                  class="usage-line"
                                  viewBox="0 0 ${columns.length} 100"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                              >
                                  <polyline
                                      points=${rates.map(
      (point) => `${this.across(view.columns, point.at).toFixed(3)},${(100 - point.rate / rateTop * 100).toFixed(2)}`
    ).join(" ")}
                                  />
                              </svg>` : A}
                    ${hovered ? this.tip(site, part, hovered.column, hovered.bill, digits, this.hovered / columns.length) : A}
                </div>
                ${most > 0 ? side(this.rateUnit(site), rate.step, "rate") : A}
            </div>
            <div class="axis">
                ${this.axis(view, part).map(
      (entry) => (
        // The bars' gaps are between them only, so a bar's middle isn't quite its share of the width.
        b2`<span
                            style="left: calc((100% + ${gap}px) * ${((entry.place + 0.5) / columns.length).toFixed(4)} - ${gap / 2}px)"
                            >${entry.label}</span
                        >`
      )
    )}
            </div>
            <div class="note">
                ${Math.abs(fees) > 5e-3 ? this.text("card.fees_not_in_bars").replace("{amount}", this.money(site, fees)) : A}
            </div>
        </div>`;
  }
  /** What the bar under the pointer holds: its cost by element and its consumption. */
  tip(site, part, column, bill, digits, across) {
    const segments = bill.segments.filter((segment) => segment.value > 0);
    const used = column.ledger.consumption;
    const side = across < 0.5 ? `left: ${(across + 1 / 48) * 100}%` : `right: ${(1 - across + 1 / 48) * 100}%`;
    return b2`<div class="tip" style=${side} aria-hidden="true">
            <b>${this.columnLabel(part, column)}</b>
            <span><span>${this.text("card.total")}</span><b>${this.money(site, bill.total, digits)}</b></span>
            ${segments.length > 1 ? segments.map(
      (segment) => b2`<span
                                  ><span><i class="dot" style="background: ${segment.color}"></i>${segment.name}</span
                                  ><span>${this.money(site, segment.value, digits)}</span></span
                              >`
    ) : A}
            ${column.future || !shows(this.config, "show_usage") ? A : b2`<span
                          ><span>${this.text("card.used")}</span
                          ><span>${this.number(used, 0, used < 10 ? 2 : 1)}${site.unit ? ` ${site.unit}` : ""}</span></span
                      >`}
        </div>`;
  }
  /** Follows a mouse or a pen over the bars. A finger's touch opens the bar instead. */
  hover(event, count) {
    if (event.pointerType === "touch") {
      return;
    }
    const plot = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - plot.left) / plot.width * count);
    this.hovered = index >= 0 && index < count ? index : void 0;
  }
  /** Where a moment is along the bars, in bars from the left, as a year's first and last weeks are shorter than their bars. */
  across(columns, at) {
    const index = columns.findIndex((column2) => at < column2.end);
    const column = columns[index];
    return column ? index + Math.max(at - column.start, 0) / (column.end - column.start) : columns.length;
  }
  /** Shows the period a bar stands for: a day's hour, a week's or a month's day, a year's week. */
  open(part, start) {
    const zone = this.zone();
    const span = { hour: HOUR_MS3, day: 24 * HOUR_MS3, week: 7 * 24 * HOUR_MS3 }[part];
    this.hovered = void 0;
    this.picked = part;
    this.offset = Math.round((periodStart(part, start, zone) - periodStart(part, Date.now(), zone)) / span);
  }
  /** The unit of consumption per hour. An energy's hours cancel out, so kWh an hour is kW. */
  rateUnit(site) {
    const power = /^(.*W)h$/.exec(site.unit ?? "")?.[1];
    return power ?? (site.unit ? `${site.unit}/h` : "/h");
  }
  bill(site, bill) {
    const config = this.config;
    const mode = this.options().tax;
    const several = this.several(site, bill);
    const rates = [...new Set(bill.elements.map((element) => element.element.tax).filter((rate) => rate > 0))];
    return b2`<div class="part list bill">
            ${bill.elements.map(
      (element) => b2`
                    ${several ? b2`<div class="element">
                                  <span class="line-name" title=${element.element.name}
                                      ><i class="dot" style="background: ${element.color}"></i>${element.element.name}</span
                                  ><span>${this.money(site, element.value)}</span>
                              </div>` : A}
                    ${listed(element, config.lines ?? "all").map(
        (item) => b2`<div class="item ${several ? "" : "flat"}">
                                <span class="line-name" title=${item.item.name}
                                    >${item.color ? b2`<i class="dot" style="background: ${item.color}"></i>` : A}${item.item.name}</span
                                ><span>${this.money(site, item.value)}</span>
                            </div>`
      )}
                `
    )}
            <div class="rule"></div>
            ${mode === "separate" && bill.tax !== 0 ? b2`<div class="sum">
                              <span>${this.text("card.before_tax")}</span><span>${this.money(site, bill.beforeTax)}</span>
                          </div>
                          <div class="sum">
                              <span
                                  >${rates.length === 1 ? this.text("card.tax_rate").replace("{rate}", this.number(rates[0], 0, 2)) : this.text("card.tax")}</span
                              ><span>${this.money(site, bill.tax)}</span>
                          </div>` : A}
            <div class="sum big">
                <span>${this.text(mode === "none" && bill.tax !== 0 ? "card.total_before_tax" : "card.total")}</span
                ><span>${this.money(site, bill.total)}</span>
            </div>
            ${mode === "included" && bill.tax !== 0 ? b2`<div class="sum small">
                          <span>${this.text("card.of_which_tax")}</span><span>${this.money(site, bill.tax)}</span>
                      </div>` : A}
        </div>`;
  }
  /** Whether the bill is told by element: with more than one, or with removed items, which must not pass for the site's own. */
  several(site, bill) {
    return site.elements.length > 1 || bill.elements.some((element) => element.element.id === REMOVED);
  }
  /** Without the bill, the colours are told by a legend, when a bar or a chart shows them. */
  legend(site, bill) {
    if (!shows(this.config, "show_share") && !shows(this.config, "show_chart")) {
      return A;
    }
    const entries = bill.elements.flatMap((element) => [
      ...this.several(site, bill) ? [{ name: element.element.name, value: element.value, color: element.color }] : [],
      ...element.items.filter((item) => item.color).map((item) => ({ name: item.item.name, value: item.value, color: item.color }))
    ]);
    if (!entries.length) {
      return A;
    }
    return b2`<div class="part list legend">
            ${entries.map(
      (entry) => b2`<span><i class="dot" style="background: ${entry.color}"></i>${entry.name} ${this.money(site, entry.value)}</span>`
    )}
        </div>`;
  }
  /** The period's name, what is said under it, and for a month a brief name for where the long one doesn't fit. */
  label(view) {
    const date = (at, options) => new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() }).format(at);
    const day = { weekday: "short", day: "numeric", month: "numeric" };
    switch (view.period) {
      case "hour": {
        const time = { hour: "2-digit", minute: "2-digit" };
        return [`${date(view.from, time)}\u2013${date(view.to, time)}`, date(view.from, day)];
      }
      case "day":
        if (this.offset === 0 || this.offset === -1) {
          return [this.text(this.offset === 0 ? "card.today" : "card.yesterday"), date(view.from, day)];
        }
        return [date(view.from, { ...day, year: "numeric" }), ""];
      case "week": {
        const short = { day: "numeric", month: "numeric" };
        return [
          this.text("card.week").replace("{number}", String(weekNumber(view.from, this.zone()))),
          `${date(view.from, short)}\u2013${date(view.to - 1, short)}`
        ];
      }
      case "month": {
        const month = date(view.from, { month: "long", year: "numeric" });
        return [
          month.charAt(0).toUpperCase() + month.slice(1),
          "",
          `${date(view.from, { month: "numeric" })}/${date(view.from, { year: "numeric" })}`
        ];
      }
      default:
        return [date(view.from, { year: "numeric" }), ""];
    }
  }
  columnLabel(part, column) {
    const date = (at, options) => new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() }).format(at);
    if (part === "hour") {
      const time = { hour: "2-digit", minute: "2-digit" };
      return `${date(column.start, time)}\u2013${date(column.end, time)}`;
    }
    if (part === "week") {
      const short = { day: "numeric", month: "numeric" };
      const week = this.text("card.week").replace(
        "{number}",
        String(weekNumber(periodStart("week", column.start, this.zone()), this.zone()))
      );
      return `${week}, ${date(column.start, short)}\u2013${date(column.end - 1, short)}`;
    }
    return date(column.start, { weekday: "short", day: "numeric", month: "numeric" });
  }
  /**
   * A few labels under the bars, each with the place of the bar it is under: every sixth hour of a day, weekdays, days
   * of a month, the months a year's weeks are in.
   */
  axis(view, part) {
    const columns = view.columns ?? [];
    const format = (options) => new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() });
    const under = (place, label2) => ({ place, label: label2 });
    if (part === "hour") {
      const hour = new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: this.zone() });
      return columns.map((column, place) => under(place, String(Number(hour.format(column.start))))).filter((entry) => Number(entry.label) % 6 === 0 || entry.place === columns.length - 1);
    }
    if (view.period === "week") {
      const weekday = format({ weekday: "short" });
      return columns.map((column, place) => under(place, weekday.format(column.start)));
    }
    const label = view.period === "year" ? format({ month: "short" }) : format({ day: "numeric" });
    const last = columns.length - 1;
    return [0, 1, 2, 3, 4].map((step2) => Math.round(step2 * last / 4)).map((place) => under(place, label.format(columns[place].start)));
  }
  heading(site) {
    return this.config?.title || site.name;
  }
  money(site, value, digits = 2) {
    return new Intl.NumberFormat(this.language(), {
      style: "currency",
      currency: site.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }
  price(site, value) {
    return `${this.number(value, 2)} ${site.price_unit}`;
  }
  number(value, digits, most = digits) {
    return new Intl.NumberFormat(this.language(), { minimumFractionDigits: digits, maximumFractionDigits: most }).format(value);
  }
  /** Home Assistant's own zone, which the integration's periods and the recorder's days are counted in. */
  zone() {
    return this.hass?.config?.time_zone;
  }
  language(hass = this.hass) {
    return hass?.locale?.language ?? hass?.language ?? browserLanguage();
  }
  text(key) {
    return translate(this.language(), key);
  }
  /**
   * The height the parts need, from the settings alone. The bill, the legend and the chart count for the least they are
   * held to, and the estimate for a line under the total, unless `boxed` asks what the card needs with the estimate's box.
   */
  minimumHeight(boxed = false) {
    const config = this.config;
    const parts = [];
    if (shows(config, "show_periods") || shows(config, "show_earlier")) {
      parts.push(HEADER_HEIGHT);
      if (shows(config, "show_periods")) parts.push(PERIODS_HEIGHT);
      parts.push(shows(config, "show_earlier") ? EARLIER_HEIGHT : LABEL_HEIGHT);
      const estimate = shows(config, "show_estimate");
      parts.push(
        TOTAL_HEIGHT + (shows(config, "show_consumption") ? CONSUMPTION_HEIGHT : 0) + (estimate && !boxed ? ESTIMATE_LINE_HEIGHT : 0)
      );
      if (estimate && boxed) parts.push(ESTIMATE_HEIGHT);
    } else {
      parts.push(this.narrowable() && this.columns() < 12 ? COMPACT_NARROW_HEIGHT : COMPACT_HEIGHT);
    }
    if (shows(config, "show_share")) parts.push(SHARE_HEIGHT);
    if (shows(config, "show_chart")) parts.push(CHART_PART_HEIGHT - CHART_HEIGHT + CHART_LEAST_HEIGHT);
    if (shows(config, "show_bill")) {
      parts.push(LIST_HEIGHT);
    } else if (shows(config, "show_legend") && (shows(config, "show_share") || shows(config, "show_chart"))) {
      parts.push(LEGEND_HEIGHT);
    }
    return 2 * PADDING + parts.reduce((sum, part) => sum + part, 0) + GAP * (parts.length - 1);
  }
  /** Whether the estimate is drawn as its box: when the height follows the content, or is held high enough for the box. */
  boxed() {
    const config = this.config ?? {};
    const rows = config.grid_options ? config.grid_options.rows : config.layout_options?.grid_rows;
    const mode = heightMode(config);
    let room;
    if (this.layout === "grid" && typeof rows === "number") {
      room = Math.max(rows, gridMinRows(this.minimumHeight())) * ROW_PX - (ROW_PX - 56);
    } else if (mode === "fixed" && config.height) {
      room = config.height;
    } else if (mode === "max" && config.max_height) {
      room = config.max_height;
    }
    return room === void 0 || room >= this.minimumHeight(true);
  }
  /** Whether the card's height is set from outside: a fixed height, a limit, or rows set in the layout tab. */
  held() {
    return heightStyle(this.config ?? {}, this.layout, this.minimumHeight()) !== "";
  }
  measureSoon() {
    cancelAnimationFrame(this.frame ?? 0);
    this.frame = requestAnimationFrame(() => {
      this.fitHead();
      this.fillRows();
    });
  }
  /**
   * In a sections view whose rows are left automatic, the card takes the whole rows its content needs, or the half rows
   * with `row_step: half`, so the cards under it stay on the rows. The room left over is spread between the parts. A
   * card held to a height spreads its room the same way while it is less than a row, and from a row up keeps its parts
   * at the top with the room under them.
   */
  fillRows() {
    const card = this.renderRoot.querySelector("ha-card");
    const content = card?.querySelector(":scope > .content");
    if (!card || !content || !card.clientWidth) {
      return;
    }
    const scale2 = drawnScale(card);
    const parts = [...content.children];
    const style = getComputedStyle(card);
    const needed = parts.reduce(
      (sum, part) => sum + (part.classList.contains("list") ? part.scrollHeight : part.classList.contains("chart") ? CHART_PART_HEIGHT : part.getBoundingClientRect().height / scale2),
      0
    ) + GAP * (parts.length - 1) + 2 * PADDING + px(style.borderTopWidth) + px(style.borderBottomWidth);
    const limit = fillLimit(this.config ?? {}, this.layout, this.minimumHeight());
    if (!limit) {
      this.filled = 0;
      this.topped = spareRoom(card.getBoundingClientRect().height / scale2, needed) >= ROW_PX;
      return;
    }
    this.topped = false;
    this.filled = filledHeight(needed, this.config ?? {}, limit);
  }
  cardClass() {
    return [this.topped ? "topped" : "", this.held() ? "held" : ""].filter(Boolean).join(" ");
  }
  cardStyle() {
    return filledStyle(this.config ?? {}, this.layout, this.minimumHeight(), this.filled);
  }
  static get styles() {
    return [
      fadeStyles,
      i`
                ha-card {
                    container-type: inline-size;
                    overflow: hidden;
                    /* Its own transition: all would slide every change in the rows filled. */
                    transition: none;
                    /* A card taller than its parts, on filled rows or held with less than a row to spare, spreads the
                       room between the parts under its head. Held with more, the parts stay at the top. */
                    display: flex;
                    flex-direction: column;
                }
                .content {
                    flex: 1 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: ${GAP}px;
                    padding: ${PADDING}px;
                    box-sizing: border-box;
                }
                /* Held lower than its parts, the card keeps all but the bill or the legend whole, and scrolls that. */
                .held .content {
                    flex: 1 1 auto;
                    min-height: 0;
                }
                .part {
                    flex: none;
                    margin-top: auto;
                }
                /* The head keeps its place when the period changes, as the switch and its arrows are pressed in turn. */
                .part:first-child,
                .part.periods,
                .part.earlier,
                .part.plain-label,
                .part.amount,
                .topped .part {
                    margin-top: 0;
                }
                /* With a chart, the spare room is the chart's, and the other parts keep their gaps. */
                .content:has(.chart) .part {
                    margin-top: 0;
                }
                .chart {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    /* Set, as a flex item's own least height is its content's, which would keep the bars from giving way. */
                    min-height: ${CHART_PART_HEIGHT - CHART_HEIGHT + CHART_LEAST_HEIGHT}px;
                }
                .chart > * {
                    flex: none;
                }
                /* A card held low scrolls its bill first, and only then draws its bars lower. */
                .held .list {
                    flex: 0 1000 auto;
                    min-height: ${LIST_HEIGHT}px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    /* Whether it scrolls or not, so the amounts don't move when it starts to. */
                    scrollbar-gutter: stable;
                    padding-inline-end: 8px;
                }
                button {
                    font: inherit;
                    color: inherit;
                    background: none;
                    border: 0;
                    padding: 0;
                    cursor: pointer;
                }
                button:disabled {
                    cursor: default;
                }
                button:focus-visible {
                    outline: 2px solid var(--primary-color);
                    outline-offset: 1px;
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: ${HEADER_HEIGHT}px;
                    --mdc-icon-size: 22px;
                    color: var(--state-icon-color, var(--secondary-text-color));
                }
                .name {
                    flex: 1;
                    min-width: 0;
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--primary-text-color);
                }
                .name,
                .names b,
                .names span,
                .names button,
                .value small,
                .row-label,
                .line-name,
                .note,
                .consumption,
                .plain-label {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .price {
                    font-size: 12px;
                    white-space: nowrap;
                    color: var(--secondary-text-color);
                }
                b {
                    font-weight: 500;
                    color: var(--primary-text-color);
                }
                .periods {
                    display: flex;
                    height: ${PERIODS_HEIGHT}px;
                    box-sizing: border-box;
                    border: 1px solid var(--divider-color);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .periods button {
                    flex: 1 1 0;
                    min-width: 0;
                    font-size: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--secondary-text-color);
                }
                .periods button.on {
                    color: var(--primary-color);
                    font-weight: 500;
                    background: color-mix(in srgb, var(--primary-color) 14%, transparent);
                }
                .periods button:focus-visible {
                    outline-offset: -2px;
                }
                .earlier {
                    display: flex;
                    align-items: center;
                    height: ${EARLIER_HEIGHT}px;
                    margin: 0 -6px;
                }
                .earlier button {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    color: var(--secondary-text-color);
                }
                .earlier button:disabled {
                    opacity: 0.25;
                }
                .label {
                    flex: 1;
                    min-width: 0;
                    text-align: center;
                    font-weight: 500;
                    line-height: 20px;
                    white-space: nowrap;
                }
                .label small {
                    display: block;
                    font-weight: 400;
                    font-size: 11px;
                    line-height: 14px;
                    color: var(--secondary-text-color);
                }
                .plain-label {
                    height: ${LABEL_HEIGHT}px;
                    line-height: ${LABEL_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .total {
                    font-size: 34px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: ${TOTAL_HEIGHT}px;
                    white-space: nowrap;
                }
                .consumption {
                    height: ${CONSUMPTION_HEIGHT}px;
                    line-height: ${CONSUMPTION_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .estimate-line {
                    height: ${ESTIMATE_LINE_HEIGHT}px;
                    line-height: ${ESTIMATE_LINE_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .estimate-line b {
                    color: var(--primary-text-color);
                }
                .compact {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    height: ${COMPACT_HEIGHT}px;
                }
                .badge {
                    flex: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    --mdc-icon-size: 20px;
                    color: var(--state-icon-color, var(--secondary-text-color));
                    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
                }
                .names {
                    flex: 1 1 auto;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    line-height: 20px;
                }
                .names b,
                .names span,
                .names button {
                    max-width: 100%;
                }
                .names span,
                .names button {
                    font-size: 12px;
                    color: var(--secondary-text-color);
                    --mdc-icon-size: 13px;
                }
                .value {
                    /* Gives way before the name and the period do, down to the total and the average. */
                    flex: 0 9999 auto;
                    min-width: min-content;
                    text-align: right;
                    font-size: 22px;
                    font-weight: 700;
                    line-height: 24px;
                    white-space: nowrap;
                }
                .value small,
                .guess small {
                    display: block;
                    height: 16px;
                    font-size: 11px;
                    font-weight: 400;
                    line-height: 16px;
                    color: var(--secondary-text-color);
                }
                /* The price now wraps onto a second line, which isn't shown, when it doesn't fit beside the average. */
                .value small {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    column-gap: 3px;
                }
                .now::before {
                    content: "· ";
                }
                .now .unit {
                    display: none;
                }
                .guess {
                    flex: none;
                    padding-right: 10px;
                    border-right: 1px solid var(--divider-color);
                    text-align: right;
                    font-size: 11px;
                    line-height: 24px;
                    color: var(--secondary-text-color);
                    white-space: nowrap;
                }
                .guess b {
                    font-size: 15px;
                    font-weight: 600;
                }
                .no-guess .guess,
                .brief,
                .brief-period .long {
                    display: none;
                }
                .brief-period .brief {
                    display: inline;
                }
                .estimate {
                    border-radius: 10px;
                    padding: 8px 10px;
                    font-size: 12.5px;
                    line-height: 18px;
                    background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
                }
                .row {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    white-space: nowrap;
                }
                .row-label {
                    min-width: 0;
                    color: var(--secondary-text-color);
                }
                .progress {
                    height: 4px;
                    border-radius: 2px;
                    margin: 5px 0 3px;
                    overflow: hidden;
                    background: var(--divider-color);
                }
                .progress i {
                    display: block;
                    height: 100%;
                    background: var(--primary-color);
                }
                .change.up {
                    color: var(--error-color, #db4437);
                }
                .change.down {
                    color: var(--success-color, #43a047);
                }
                .share {
                    position: relative;
                }
                .share .tip {
                    top: ${SHARE_HEIGHT + 4}px;
                }
                .share-bar {
                    display: flex;
                    height: ${SHARE_HEIGHT}px;
                    border-radius: 5px;
                    overflow: hidden;
                    background: var(--divider-color);
                }
                .share-bar i {
                    display: block;
                    height: 100%;
                }
                .chart {
                    --scale: 32px;
                }
                /* A legend is short, so the bars give way to it first, and it scrolls only when they are at their least. */
                .held .legend {
                    flex-shrink: 1;
                    min-height: ${LEGEND_HEIGHT}px;
                }
                .held .content:has(.legend) .chart {
                    flex-shrink: 1000;
                }
                .chart > .plot {
                    flex: 1 1 ${CHART_HEIGHT}px;
                    min-height: ${CHART_LEAST_HEIGHT}px;
                }
                .plot {
                    display: flex;
                    /* Room for the scales' units, and for the top step's number. */
                    padding-top: 14px;
                    box-sizing: border-box;
                }
                .bars {
                    position: relative;
                    flex: 1 1 0;
                    min-width: 0;
                    display: flex;
                    align-items: flex-end;
                    gap: 2px;
                    border-bottom: 1px solid var(--divider-color);
                }
                .bars.dense {
                    gap: 1px;
                }
                .grid {
                    position: absolute;
                    left: 0;
                    right: 0;
                    border-top: 1px solid var(--divider-color);
                    opacity: 0.6;
                    pointer-events: none;
                }
                .scale {
                    position: relative;
                    flex: none;
                    width: var(--scale);
                    font-size: 10.5px;
                    line-height: 14px;
                    color: var(--secondary-text-color);
                    white-space: nowrap;
                }
                .scale span {
                    position: absolute;
                    right: 6px;
                    transform: translateY(50%);
                }
                .scale.rate span {
                    right: auto;
                    left: 6px;
                }
                /* The units are over the bars' ends, in the room above the top line, clear of the steps' numbers. */
                .scale .unit {
                    top: -14px;
                    left: 100%;
                    right: auto;
                    margin: 0 4px;
                    transform: none;
                }
                .scale.rate .unit {
                    left: auto;
                    right: 100%;
                }
                .column {
                    flex: 1 1 0;
                    cursor: default;
                    min-width: 0;
                    height: 100%;
                    display: flex;
                    flex-direction: column-reverse;
                }
                .column i {
                    display: block;
                    flex: none;
                }
                button.column {
                    cursor: pointer;
                }
                .plot:hover .column:hover {
                    filter: brightness(1.15);
                }
                .tip {
                    position: absolute;
                    top: 0;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 110px;
                    max-width: 60%;
                    padding: 6px 8px;
                    border-radius: 8px;
                    background: var(--card-background-color, var(--ha-card-background));
                    border: 1px solid var(--divider-color);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    font-size: 11px;
                    line-height: 15px;
                    pointer-events: none;
                    white-space: nowrap;
                }
                .tip > span {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    color: var(--secondary-text-color);
                }
                .tip > span > b {
                    color: var(--primary-text-color);
                }
                .tip .dot {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 2px;
                    margin-inline-end: 5px;
                }
                /* The part under way is marked under the baseline, clear of its bar and in no bar's colour. */
                .column {
                    position: relative;
                }
                .column.current::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: -3px;
                    height: 2px;
                    border-radius: 1px;
                    background: var(--primary-text-color);
                }
                .usage-line {
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                    pointer-events: none;
                }
                .usage-line polyline {
                    fill: none;
                    stroke: var(--utility-cost-usage-color, var(--primary-text-color));
                    /* See-through, so a busy line doesn't hide the bars under it. */
                    stroke-opacity: 0.8;
                    stroke-width: 1.5px;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                    vector-effect: non-scaling-stroke;
                }
                .axis {
                    position: relative;
                    margin-left: var(--scale);
                    /* The labels sit low in their row, clear of the mark under the part under way. */
                    box-sizing: border-box;
                    height: 18px;
                    padding-top: 5px;
                    line-height: 13px;
                    font-size: 10.5px;
                    color: var(--secondary-text-color);
                }
                /* Each label is centred under its own bar. */
                .axis span {
                    position: absolute;
                    transform: translateX(-50%);
                    white-space: nowrap;
                }
                .lined .axis {
                    margin-right: var(--scale);
                }
                .note {
                    height: 16px;
                    line-height: 16px;
                    font-size: 11px;
                    color: var(--secondary-text-color);
                }
                .dot {
                    display: inline-block;
                    flex: none;
                    width: 10px;
                    height: 10px;
                    border-radius: 3px;
                    margin-right: 8px;
                }
                .element,
                .item,
                .sum {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    line-height: 20px;
                }
                .element span:last-child,
                .item span:last-child,
                .sum span:last-child {
                    flex: none;
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                }
                .line-name {
                    min-width: 0;
                }
                .element {
                    font-weight: 500;
                    padding: 6px 0 2px;
                }
                .element:first-child {
                    padding-top: 0;
                }
                .item {
                    padding: 2px 0 2px 18px;
                    color: var(--secondary-text-color);
                }
                .item.flat {
                    padding-left: 0;
                }
                .rule {
                    border-top: 1px solid var(--divider-color);
                    margin: 8px 0 4px;
                }
                .sum {
                    padding: 2px 0;
                }
                .sum.big {
                    font-weight: 700;
                    font-size: 15px;
                }
                .sum.small {
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px 14px;
                    font-size: 12px;
                    line-height: 20px;
                    color: var(--secondary-text-color);
                }
                .legend span {
                    display: inline-flex;
                    align-items: center;
                }
                .message {
                    color: var(--secondary-text-color);
                }
                /* At a card narrower than about 350 px, by its width inside its border. */
                @container (max-width: 346px) {
                    .total {
                        font-size: 28px;
                    }
                    .price-label {
                        display: none;
                    }
                }
                /* At a card narrower than 300 px, the one-row head is on two lines: the name and the period, then the total. */
                @container (max-width: 266px) {
                    .compact {
                        flex-wrap: wrap;
                        gap: 0 8px;
                        height: ${COMPACT_NARROW_HEIGHT}px;
                    }
                    .badge,
                    .guess {
                        display: none;
                    }
                    .names {
                        flex: 1 0 100%;
                        flex-direction: row;
                        align-items: baseline;
                        justify-content: space-between;
                        gap: 8px;
                    }
                    /* A long name and a long period share the line, each cut short by its share. */
                    .names b,
                    .names span,
                    .names button {
                        min-width: 0;
                    }
                    .value {
                        flex: 1 0 100%;
                        text-align: left;
                    }
                    /* The brief name is whole, and the site's name is cut short for it. */
                    .brief-period .period {
                        flex: none;
                    }
                    .value small {
                        justify-content: space-between;
                    }
                    .now::before {
                        content: none;
                    }
                    .now .unit {
                        display: inline;
                    }
                }
            `
    ];
  }
};
__decorateClass([
  n4({ attribute: false })
], UtilityCostCard.prototype, "hass", 2);
__decorateClass([
  n4({ attribute: false })
], UtilityCostCard.prototype, "layout", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "config", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "site", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "view", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "failed", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "picked", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "offset", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "sharing", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "hovered", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "filled", 2);
__decorateClass([
  r5()
], UtilityCostCard.prototype, "topped", 2);
var px = (value) => Number.parseFloat(value) || 0;
if (!customElements.get("utility-cost-card")) {
  console.info(
    `%c  UTILITY-COST-CARD 
%c  ${CARD_VERSION}    `,
    "color: lightblue; font-weight: bold; background: black",
    "color: white; font-weight: bold; background: dimgray"
  );
  const registry = window;
  registry.customCards = registry.customCards ?? [];
  registry.customCards.push({
    type: "utility-cost-card",
    name: translate(browserLanguage(), "common.name"),
    description: translate(browserLanguage(), "common.description"),
    documentationURL: "https://github.com/jesmak/utility_cost_tracker#utility-cost-card",
    preview: true
  });
  customElements.define("utility-cost-card", UtilityCostCard);
}
export {
  UtilityCostCard
};
