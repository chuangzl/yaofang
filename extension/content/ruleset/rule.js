/**
 * 这个文件用于描述一条规则
 *
 * yawf.rule.<ruleType>(details: object) 新建一条规则
 * <ruleType>:
 *   Rule: 普通规则，普通规则应当属于一个 Group
 *   Text: 纯文本（仅用于展示，一般不承担功能），纯文本是普通规则的一个特例
 *   Tab: 标签页，是最顶层的规则，其中包含若干 Group
 *   Group: 规则分组（小标题），属于一个 Tab，其中包含若干 Rule
 *
 * 普通规则 Rule 是一个 BooleanConfigItem，会默认带一个开关
 *   如果不希望显示开关，则需要在 details 里指定 always: true 此时认为
 *
 * ConfigItem 用于描述一个界面元素，或一个对应的设置项
 * yawf.rule.class.ConfigItem 的构造函数一般不需要从外部调用
 * 一条 Rule 或者 Rule 的 ref 属性，是一个 ConfigItem
 * ref 属性下的 ConfigItem 的类型由构造时对象的 type 属性决定：
 *   TODO
 *
 * ConfigItem 的属性和方法包括：
 * 显示相关
 *   template() （可选） 用于显示的模板
 *   render(isRoot: boolean) （可选） 显示的函数，如果缺省则使用 template 属性根据规则生成
 *   afterRender(container: Element) （可选） 在调用 render 后可用这个函数对产生的 DOM 做进一步修改
 *   text(isRoot: boolean) （可选） 显示的文本，如果缺省则使用 template 或 render 根据规则生成
 * 设置相关
 *   initial(): any 设置的默认值
 *   normalize(value: any): any 对设置值进行规范化
 *   getConfig(): any 获取设置
 *   setConfig(value: any): any 写入新设置
 *   addConfigListener(callback: (newValue: any, oldValue: any) => void) 当设置改变时回调
 *   removeConfigListener(callback) 取消添加的设置改变的回调
 *
 * BooleanConfigItem 继承自 ConfigItem 包括属性和方法：
 *   always(): boolean = false 如果该属性为 true，那么显示时不带复选框，没有对应的设置项，检查时总是已启用
 *   isEnabled(): boolean 检查是否已启用
 *
 * SelectConfigItem 继承自 ConfigItem
 *   指定 select 属性为 Array<{ name: string, value: string }>，可以用于渲染选择框
 *
 * NumberConfigItem 继承自 ConfigItem
 *   指定 min, max, step 属性，类型 number，可用于输入一个数字
 *
 * RangeConfigItem 继承自 NumberConfigItem
 *   相比 Number 多了一个拖动条以方便输入
 *
 * BubbleConfigItem 继承自 ConfigItem
 *   不存储数据，仅用来展示一个气泡弹窗
 *   使用 icon 属性描述图标类型，模板内容将会渲染到气泡中
 *
 * RuleItem 继承自 BooleanConfigItem 包括属性和方法：
 *   parent 构造时如指定 parent，则会将该规则加入到其父亲的子集合中
 *   children: Array<RuleItem> 构造时自动初始化的数组，用于维护其子集合
 *   type: string = "normal": 规则的类型，用于标记 Tab 和 Group
 *
 * Tab, Group 继承自 RuleItem：
 *   这两个会自动带有 always => true，且有特殊的 type，有特殊的渲染逻辑
 *
 * Rule 继承自 RuleItem，在外部构造时使用 yawf.rule.Rule 构造器构造（无需 new 关键字），包括：
 *   css: string | () => string 这条规则注册的 CSS，无论规则是否启用均会生效
 *   acss: string | () => string 这条规则注册的 CSS，仅启用该条规则后生效
 *   init: () => void 当初始化时调用，无论规则是否启用均会生效
 *   ainit: () => void 当初始化时调用，仅启用该条规则后生效
 *
 * Text 继承自 Rule，在外部构造时使用 yawf.rule.Text 构造器构造（无需 new 关键字）：
 *   实现了特殊的渲染逻辑
 *
 * yawf.rule.tabs: Array<Tab> 用于维护所有注册的标签页
 * yawf.rule.query({
 *   base: Array<RuleItem> = yawf.rule.tabs
 * }): Array<Rule> 用于根据筛选条件列出对应的规则
 */
; (async function () {

  const yawf = window.yawf;

  const util = yawf.util;
  const storage = yawf.storage;
  const config = yawf.config;
  const init = yawf.init;

  const css = util.css;
  const ui = util.ui;
  const i18n = util.i18n;
  const priority = util.priority;

  const rule = yawf.rule = {};
  const rules = yawf.rules = {};
  const tabs = rule.tabs = [];

  rule.class = {};

  /**
   * 这里维护一个基本的设置项
   * 我们在这一层维护：
   *   基于 template 属性的通用渲染逻辑
   *   基于 ref 属性的父子关系（用于渲染）
   * @constructor
   * @param {object} self
   */
  const BaseConfigItem = function BaseConfigItem(self) {
    if (!self.ref) self.ref = {};
    Object.keys(self.ref).forEach(key => {
      if (self.ref[key] instanceof BaseConfigItem) return;
      if (!self.ref[key].id) self.ref[key].id = key;
      self.ref[key] = configItemBuilder(self.ref[key], self);
    });
    // 如果使用 Object.assign 将 self 上的内容拷贝到 this 上
    //   将会丢失 self 上的所有的 getter / setter
    //   且当原型上有 setter 时会发生错误
    // 因此我们为 self 设置正确的 __proto__，并直接返回 self
    // 只要子类不在 super 之前访问 this，这样做是很安全的
    // 一般不推荐这种做法，但是这里用起来实在是感觉太好了
    Object.setPrototypeOf(self, Object.getPrototypeOf(this));
    return self;
  };
  /**
   * @returns {string}
   */
  BaseConfigItem.prototype.template = function () { return ''; };

  /** @param {boolean} fullDom */
  const parseTemplate = function (fullDom) {
    const item = this;
    /**
     * @typedef {{ type: string, value: string }} TemplateToken
     */
    /** @type {(template: string) => Array<TemplateToken>} */
    const tokenize = function (template) {
      const parseReg = new RegExp([
        String.raw`\{\{([^\}]+)\}\}`, // {{child}}
        String.raw`\[\[([^\]]+)\]\]`, // [[rule]]
        String.raw`(\|\||\|)`, // || or |
        String.raw`([^\|\[\{\&]+|&[^;]+;)`, // text
      ].map(reg => `(?:${reg})`).join('|'), 'g');
      /** @type {string?[][]} */
      const matches = [];
      while (true) {
        const match = parseReg.exec(template);
        if (!match) break;
        matches.push([...match]);
      }
      const tokens = matches.map(([_, ...typed]) => {
        const types = ['child', 'rule', 'splitter', 'text'];
        const index = typed.findIndex(x => x);
        if (index === -1) return null;
        return { type: types[index], value: typed[index] };
      }).filter(token => token);
      return tokens;
    };

    /** @type {(tokens: Array<TemplateToken>, acceptTypes: Iterable<string>) => Array<TemplateToken>} */
    const filteredTokens = function (tokens, acceptTypes) {
      const types = new Set(acceptTypes);
      return tokens.filter(token => token && types.has(token.type));
    };

    /**
     * @typedef {(token: TemplateToken, reference: Node, ref: UiItemCollection) => Node} TemplateTokenRender
     */
    /** @type {Object<string, TemplateTokenRender>} */
    const tokenRender = {};

    /** @type {TemplateTokenRender} */
    tokenRender.child = function (token, reference, ref) {
      if (fullDom) {
        reference.appendChild(ref[token.value].render(false));
      } else {
        reference.appendChild(ref[token.value].text(false));
      }
      return reference;
    };
    /** @type {TemplateTokenRender} */
    tokenRender.rule = function (token, reference, ref) {
      reference.appendChild(ruleRender(rule.all.get(token.value)));
      return reference;
    };
    /** @type {TemplateTokenRender} */
    tokenRender.splitter = function (token, reference, ref) {
      const parent = reference.parentNode;
      const label = document.createElement('label');
      parent.insertBefore(label, reference.nextSibling);
      if (token.value === '||') {
        const br = document.createElement('br');
        parent.insertBefore(br, reference.nextSibling);
      }
      return label;
    };
    /** @type {TemplateTokenRender} */
    tokenRender.text = function (token, reference, ref) {
      const text = token.value.startsWith('&') ? {
        '&amp;': '&',
      }[token.value] : token.value;
      reference.appendChild(document.createTextNode(text));
      return reference;
    };
    /** @type {Array<string>} */
    let acceptTypes = [];
    const itemRender = function (template, ref, mode = null) {
      const types = mode && (acceptTypes = {
        normal: ['child', 'splitter', 'text'],
        recursive: ['child', 'splitter', 'text', 'rule'],
        text: ['child', 'text'],
      }[mode || 'normal']) || acceptTypes.filter(type => type !== 'rule');
      const reference = document.createElement('label');
      const container = document.createElement('span');
      container.classList.add('yawf-config-item');
      container.appendChild(reference);
      const tokens = filteredTokens(tokenize(template), types);
      tokens.reduce((reference, token) => (
        tokenRender[token.type](token, reference, ref)
      ), reference);
      return container;
    };

    const ruleRender = function (isRoot = true) {
      if (!this.template) return null;
      const template = this.template();
      const ref = this.ref;
      const mode = fullDom ? isRoot ? 'recursive' : 'normal' : 'text';
      return itemRender(template, ref, mode);
    };

    return ruleRender;
  };

  /**
   * render 是通用的基于 template 的渲染逻辑
   */
  BaseConfigItem.prototype.render = parseTemplate(true);
  /**
   * text 是通用的检查包含文字的逻辑
   */
  BaseConfigItem.prototype.text = ((parse => function (isRoot = true) {
    let result;
    if (this.template) result = parse.apply(this);
    else result = this.render();
    return result && result.textContent.trim() || '';
  })(parseTemplate(false)));
  /**
   * 渲染包括 render 和一个可选的 afterRender
   * 这里包装两个函数，如果需要重载渲染逻辑，应该重载 render
   * 如果需要获得渲染结果，应该使用这个方法
   */
  BaseConfigItem.prototype.getRenderResult = function () {
    let node = this.render();
    if (typeof this.afterRender === 'function') {
      node = this.afterRender(node);
    }
    return node;
  };

  const nextConfigId = (function () {
    let lastIndex = Math.floor(Math.random() * 1e7) * 10;
    /**
     * @return {string} 返回一个在此次运行中唯一的值，用来标识独立的设置项
     */
    return function () {
      lastIndex += Math.floor(Math.random() * 100);
      const rand = Math.random().toString(36).slice(2);
      const index = lastIndex.toString(36);
      return `yawf-${rand}-${lastIndex}`;
    };
  }());

  /**
   * 一个可能带有设置的项目
   * 我们在这一层维护所有和设置有关的内容，包括
   *   设置的读写
   *   设置的合法性验证
   *   设置更新时回调更新数据的渲染逻辑
   */
  class ConfigItem extends BaseConfigItem {
    /**
     * @param {object} item 子设置项
     * @param {ConfigItem} context 父设置项（item 应当在是该设置项的 ref 中）
     */
    constructor(item, context) {
      super(item);
      if (context) {
        this.context = context;
        if (this.id) this.id = context.id + '.' + this.id;
      }
      this.configId = nextConfigId();
      this.configInitialized = false;
    }
    /**
     * @returns {any} 表示设置的初始值
     */
    get initial() { return null; }
    /**
     * @param {any} 未格式化的设置项
     * @returns {any} 根据该设置项允许的取值格式化后的设置项，此时设置项总是合法的
     */
    normalize(value) { return value; }
    /**
     * 一个项目不一定总是需要包含设置项
     * 如果没有调用过任何 getConfig, setConfig 等方法，则不会为该项目分配设置项
     * 在第一次调用任何和设置项相关的方法时，我们试图分配设置项
     */
    initConfig() {
      if (this.configInitialized) return;
      if (!this.config) {
        if (!this.id) throw Error('id is required to init config');
        this.config = config.user.key(this.id);
      }
      this.configInitialized = true;
      this.config.addListener(newValue => {
        const items = this.getRenderItems();
        console.log('callback listen %o for %o: update %o', this.id, this.configId, items);
        items.forEach(item => this.renderValue(item));
      });
    }
    /**
     * 读取设置项
     * @return {any} 当前设置项的值
     */
    getConfig() {
      this.initConfig();
      const value = this.config.get();
      const normalize = this.normalize(value);
      if (value && JSON.stringify(value) !== normalize && JSON.stringify(normalize)) {
        this.config.set(normalize);
      }
      return normalize;
    }
    /**
     * 写入设置项
     * @param {any} value 当前设置项的值
     * @return {any} 实际写入的值（经过格式化）
     */
    setConfig(value) {
      this.initConfig();
      const normalize = this.normalize(value);
      this.config.set(normalize);
      return normalize;
    }
    /**
     * 当设置项变化时的回调
     * 注意不要在回调函数中保留设置项渲染出来的文档节点的引用，否则可能造成垃圾回收失效
     * @param {Function} callback 当设置项变化时的回调函数
     * @return {{removeConfigListener: Function}}
     */
    addConfigListener(callback) {
      this.initConfig();
      const { removeListener } = this.config.addListener(callback);
      return { removeConfigListener: removeListener };
    }
    render(...args) {
      const node = super.render(...args);
      // 在渲染时标记该元素的设置 id
      // 当需要更新设置时可以方便地从界面上找到该元素
      node.setAttribute('yawf-config-item', this.configId);
      return node;
    }
    /**
     * 根据设置 id 找到所有该设置项渲染的实例
     */
    getRenderItems() {
      const selector = `[yawf-config-item="${this.configId}"]`;
      return Array.from(document.querySelectorAll(selector));
    }
    /**
     * 更新渲染项的值 
     * @param {HTMLElement} container
     */
    renderValue(container) {
      return container;
    }
  }
  rule.class.ConfigItem = ConfigItem;

  /**
   * 一个布尔设置项
   * 有个 checkbox
   * 使用默认的渲染逻辑，复选框加到最前面
   */
  class BooleanConfigItem extends ConfigItem {
    constructor(item, parent) {
      super(item, parent);
    }
    get initial() { return false; }
    normalize(value) {
      if (value == null) return this.initial;
      return !!value;
    }
    isEnabled() {
      return this.always || this.getConfig();
    }
    render(...args) {
      const container = super.render(...args);
      if (this.always) return container;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('W_checkbox');
      checkbox.setAttribute('yawf-config-input', this.configId);
      checkbox.addEventListener('change', event => {
        if (!event.isTrusted) {
          this.renderValue(container);
        } else this.setConfig(checkbox.checked);
      });
      const label = container.querySelector('label');
      label.insertBefore(checkbox, label.firstChild);
      checkbox.checked = this.getConfig();
      return container;
    }
    renderValue(container) {
      container = super.renderValue(container);
      const selector = `input[type="checkbox"][yawf-config-input="${this.configId}"]`;
      const checkbox = container.querySelector(selector);
      const config = this.getConfig();
      if (checkbox && checkbox.checked !== config) {
        checkbox.checked = config;
      }
      return container;
    }
  }
  rule.class.BooleanConfigItem = BooleanConfigItem;

  /**
   * 一个多选一设置项
   * 有个 select 下拉选择框
   * 需要配置 select 属性为 Array<{ value: string, name: string }> 用于候选项
   * 不使用默认的渲染逻辑
   */
  class SelectConfigItem extends ConfigItem {
    constructor(item, parent) {
      super(item, parent);
      const select = this.select;
      if (!select || !Array.isArray(select)) {
        throw TypeError('`select` attribute is required for select config item');
      }
      if (select.some(item => item.value !== '' + item.value)) {
        throw TypeError("Select options' value should be string");
      }
    }
    get initial() {
      if (!this.select) return null;
      if (!this.select[0]) return null;
      return this.select[0].value;
    }
    normalize(value) {
      if (!this.select || !Array.isArray(this.select)) return null;
      if (this.select.find(item => item.value === value)) return value;
      return this.initial;
    }
    render() {
      const container = document.createElement('span');
      container.setAttribute('yawf-config-item', this.configId);
      container.classList.add('yawf-config-select');
      if (!Array.isArray(this.select) || !this.select) {
        return container;
      }
      const select = document.createElement('select');
      this.select.forEach(({ text, value }) => {
        const option = document.createElement('option');
        option.value = value;
        option.text = typeof text === 'function' ? text() : text;
        select.add(option);
      });
      select.setAttribute('yawf-config-input', this.configId);
      select.value = this.getConfig();
      select.addEventListener('change', event => {
        if (!event.isTrusted) {
          this.renderValue(container);
        } else this.setConfig(select.value);
      });
      container.appendChild(select);
      return container;
    }
    renderValue(container) {
      container = super.renderValue(container);
      const selector = `select[yawf-config-input="${this.configId}"]`;
      const select = container.querySelector(selector);
      const config = this.getConfig();
      if (select && select.value !== config) {
        select.value = config;
      }
      return container;
    }
  }
  rule.class.SelectConfigItem = SelectConfigItem;

  /**
   * 一个数字输入框
   * 允许定义 min, max, step 属性
   * 对应一个 number 输入框
   */
  class NumberConfigItem extends ConfigItem {
    constructor(item, parent) {
      super(item, parent);
    }
    get initial() { return this.min; }
    get min() { return 0; }
    get max() { return Infinity; }
    get step() { return 1; }
    normalize(value) {
      let number = +value;
      if (!Number.isFinite(number)) return this.initial;
      if (+this.min === this.min && number < this.min) number = this.min;
      if (+this.max === this.max && number > this.max) number = this.max;
      if (+this.step === this.step && Number.isFinite(this.step)) {
        number -= (number - this.min) % this.step;
      }
      return number;
    }
    render() {
      const container = document.createElement('span');
      container.setAttribute('yawf-config-item', this.configId);
      container.classList.add('yawf-config-number');
      const input = document.createElement('input');
      input.type = 'number';
      input.value = this.getConfig();
      if (+this.min === this.min && this.min !== -Infinity) input.min = this.min;
      if (+this.max === this.max && this.max !== Infinity) input.max = this.max;
      if (+this.step === this.step && Number.isFinite(this.step)) input.step = this.step;
      input.addEventListener('input', event => {
        if (!event.isTrusted) input.value = this.getConfig();
        else this.setConfig(+input.value);
      });
      input.addEventListener('blur', event => {
        input.value = this.getConfig();
      });
      input.setAttribute('yawf-config-input', this.configId);
      container.appendChild(input);
      return container;
    }
    renderValue(container) {
      container = super.renderValue(container);
      const selector = `input[type="number"][yawf-config-input="${this.configId}"]`;
      const number = container.querySelector(selector);
      const config = this.getConfig();
      if (number && +number.value !== this.config) {
        number.value = config;
      }
      return container;
    }
  }
  rule.class.NumberConfigItem = NumberConfigItem;

  /**
   * 范围输入框
   * 和数字输入框没什么差别，除了多了一个范围拖动条
   * 仅当 min、max 都设置了时才会有效
   */
  class RangeConfigItem extends NumberConfigItem {
    render() {
      const container = super.render();
      container.setAttribute('yawf-config-item', this.configId);
      if (+this.min !== this.min) return container;
      if (!Number.isFinite(this.min)) return container;
      if (+this.max !== this.max) return container;
      if (!Number.isFinite(this.max)) return container;
      if (+this.step !== this.step) return container;
      if (!Number.isFinite(this.step)) return container;
      container.classList.add('yawf-config-range');
      const ranger = document.createElement('span');
      ranger.classList.add('yawf-config-range-wrap');
      const range = document.createElement('input');
      range.type = 'range';
      ranger.appendChild(range);
      container.appendChild(ranger);
      range.min = this.min;
      range.max = this.max;
      range.step = this.step;
      range.addEventListener('input', event => {
        if (!event.isTrusted) range.value = this.getConfig();
        else this.setConfig(+range.value);
      });
      range.addEventListener('blur', event => {
        this.renderValue();
      });
      range.value = this.getConfig();
      range.setAttribute('yawf-config-input', this.configId);
      return container;
    }
    renderValue(container) {
      container = super.renderValue(container);
      const selector = `input[type="range"][yawf-config-input="${this.configId}"]`;
      const range = container.querySelector(selector);
      const config = this.getConfig();
      if (range && +range.value !== this.config) {
        range.value = config;
      }
      return container;
    }
  }
  rule.class.RangeConfigItem = RangeConfigItem;

  /**
   * 显示一个小图标，鼠标划上去可以显示弹出起泡
   * 这个项目不对应设置值
   */
  class BubbleConfigItem extends BaseConfigItem {
    constructor(item, parent) {
      super(item, parent);
    }
    render(...args) {
      const content = super.render(...args);
      const container = document.createElement('span');
      const iconType = this.icon || 'ask';
      const icon = document.createElement('i');
      icon.classList.add('W_icon', 'yawf-bubble-icon', `icon_${iconType}S`);
      container.appendChild(icon);
      ui.bubble(content, icon);
      return container;
    }
  }
  rule.class.BubbleConfigItem = BubbleConfigItem;

  const configItemBuilder = function (item, parent) {
    if (item && item.type === 'boolean') return new BooleanConfigItem(item, parent);
    if (item && item.type === 'select') return new SelectConfigItem(item, parent);
    if (item && item.type === 'number') return new NumberConfigItem(item, parent);
    if (item && item.type === 'range') return new RangeConfigItem(item, parent);
    if (item && item.type === 'bubble') return new BubbleConfigItem(item, parent);
    return new ConfigItem(item, parent);
  };

  /**
   * 描述一个出现在设置窗口中的项目
   */
  class RuleItem extends BooleanConfigItem {
    get type() { return 'normal'; }
    constructor(item) {
      super(item, null);
      if (this.parent) {
        this.parent.children.push(this);
      }
    }
  }

  /**
   * 描述设置窗口的一个标签页
   */
  class Tab extends RuleItem {
    constructor(item) {
      super(item);
      this.children = [];
      tabs.push(this);
    }
    get type() { return 'tab'; }
    get always() { return true; }
    render() {
      const span = document.createElement('span');
      span.textContent = this.template();
      return span;
    }
  }
  const tabBuilder = rule.Tab = function (item) {
    return new Tab(item);
  };
  rule.class.Tab = Tab;

  /**
   * 描述窗口的一组设置，一组设置有一个加粗文字显示的标题
   */
  class Group extends RuleItem {
    constructor(item) {
      if (!(item.parent instanceof Tab)) {
        throw TypeError('Group must in some Tab');
      }
      super(item);
      this.children = [];
    }
    get type() { return 'group'; }
    get always() { return true; }
    render() {
      const node = super.render();
      node.classList.add('yawf-config-group');
      return node;
    }
  }
  const groupBuilder = rule.Group = function (item) {
    return new Group(item);
  };
  rule.class.Group = Group;

  /**
   * 描述一条设置
   * 设置会调用 execute 初始化一次
   * 不要重载 execute 实现逻辑，相反，应该重载以下几个属性：
   *   css: string 描述该设置需要加入的 CSS，无论是否打开设置均会生效
   *   acss: string 仅当该设置打开时加入这些 CSS
   *   init: Function 初始化时会回调一次
   *   ainit: Function 仅当该设置打开时，初始化时回调一次
   */
  class Rule extends RuleItem {
    constructor(item) {
      if (!(item.parent instanceof Group)) {
        throw TypeError('Rule must in some Group');
      }
      super(item);
    }
    render() {
      const node = super.render();
      node.classList.add('yawf-config-rule');
      return node;
    }
    execute() {
      const enabled = this.isEnabled();
      try {
        const styles = [];
        if (typeof this.css === 'string') styles.push(this.css);
        if (typeof this.css === 'function') styles.push(this.css());
        if (enabled) {
          if (typeof this.acss === 'string') styles.push(this.acss);
          if (typeof this.acss === 'function') styles.push(this.acss());
        }
        rule.style.append(styles.join('\n'));
        if (typeof this.init === 'function') this.init();
        if (enabled) {
          if (typeof this.ainit === 'function') this.ainit();
        }
      } catch (e) {
        util.debug('Error while execute rule %o: %o', this, e);
      }
    }
  }
  const ruleBuilder = rule.Rule = function (item) {
    return new Rule(item);
  };
  rule.class.Rule = Rule;

  /**
   * 设置中的一个纯文本项，这个设置项没有复选框
   * 继承自有复选框的设置项，此时认为该复选框是总被选中的
   */
  class Text extends Rule {
    constructor(item) {
      super(item);
      this.always = true;
    }
    render() {
      const node = super.render();
      node.classList.add('yawf-config-text');
      return node;
    }
  }
  const textBuilder = rule.Text = function (item) {
    return new Text(item);
  };
  rule.class.Text = Text;

  /**
   * 从所有设置项中根据条件筛选出一些设置项
   * 之后可用于展示对话框等操作
   * @param {{ base: Tab[] }} base 描述搜索范围
   */
  const query = rule.query = function ({ base = tabs } = {}) {
    const result = new Set();
    ; (function query(items) {
      items.forEach(item => {
        if (item instanceof Tab || item instanceof Group) {
          query(item.children);
        }
        if (!(item instanceof Rule)) return;
        result.add(item);
      });
    }(base));
    return [...result];
  };

  rule.init = function () {
    rule.style = css.add('');
    rule.query().forEach(rule => rule.execute());
  };

  init.onReady(async () => {
    rule.init();
  }, { priority: priority.DEFAULT, async: true });

  css.add(`
.yawf-config-rule > label + label { margin-left: 8px; }
.yawf-config-rule > br + label { margin-left: 20px; }
.yawf-bubble-icon { vertical-align: middle; margin-left: 2px; margin-right: 2px; }
.yawf-config-number input[type="number"] { width: 45px; box-sizing: border-box; }
.yawf-config-range { position: relative; }
.yawf-config-range-wrap { display: none; position: absolute; left: 0; right: 0; margin: 0; bottom: calc(100% + 2px); height: 80px; background: #f0f0f0; background: Menu; }
.yawf-config-range:focus-within .yawf-config-range-wrap { display: block; }
.yawf-config-range input[type="range"] { position: absolute; top: 0; bottom: 0; margin: auto; width: 75px; right: -20px; left: -20px; transform: rotate(-90deg); }
`);

}());

