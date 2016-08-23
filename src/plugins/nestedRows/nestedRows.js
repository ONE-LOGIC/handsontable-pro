import BasePlugin from 'handsontable/plugins/_base';
import {registerPlugin} from 'handsontable/plugins';
import {rangeEach, rangeEachReverse} from 'handsontable/helpers/number';
import {arrayEach} from 'handsontable/helpers/array';
import {DataManager} from './data/dataManager';
import {CollapsingUI} from './ui/collapsing';
import {HeadersUI} from './ui/headers';
import {ContextMenuUI} from './ui/contextMenu';

const privatePool = new WeakMap();

/**
 * @plugin NestedRows
 *
 * @description
 * Plugin responsible for displaying and operating on data sources with nested structures.
 *
 * @dependencies TrimRows, BindRowsWithHeaders
 */
class NestedRows extends BasePlugin {

  constructor(hotInstance) {

    privatePool.set(this, {
      changeSelection: false,
      movedToParentBegin: false,
      target: void 0,
    });

    /**
     * Source data object.
     *
     * @type {Object}
     */
    this.sourceData = null;
    /**
     * Reference to the Trim Rows plugin.
     *
     * @type {Object}
     */
    this.trimRowsPlugin = null;
    /**
     * Reference to the Manual Row Move plugin.
     *
     * @type {Object}
     */
    this.manualRowsMovePlugin = null;
    /**
     * Reference to the BindRowsWithHeaders plugin.
     *
     * @type {Object}
     */
    this.bindRowsWithHeadersPlugin = null;

    /**
     * Reference to the DataManager instance.
     *
     * @type {Object}
     */
    this.dataManager = null;

    /**
     * Reference to the HeadersUI instance.
     *
     * @type {Object}
     */
    this.headersUI = null;

    //TODO: make this private maybe?
    this.skipRender = null;

    super(hotInstance);
  }

  /**
   * Checks if the plugin is enabled in the settings.
   */
  isEnabled() {
    return !!this.hot.getSettings().nestedRows;
  }

  /**
   * Enable the plugin.
   */
  enablePlugin() {
    this.sourceData = this.hot.getSourceData();
    this.trimRowsPlugin = this.hot.getPlugin('trimRows');
    this.manualRowsMovePlugin = this.hot.getPlugin('manualRowMove');
    this.bindRowsWithHeadersPlugin = this.hot.getPlugin('bindRowsWithHeaders');

    this.dataManager = new DataManager(this, this.hot, this.sourceData);
    this.collapsingUI = new CollapsingUI(this, this.hot, this.trimRowsPlugin);
    this.headersUI = new HeadersUI(this, this.hot);
    this.contextMenuUI = new ContextMenuUI(this, this.hot);

    this.dataManager.rewriteCache();

    this.addHook('beforeRender', (force, skipRender) => this.onBeforeRender(force, skipRender));
    this.addHook('modifyRowData', (row) => this.onModifyRowData(row));
    this.addHook('modifySourceLength', () => this.onModifySourceLength());
    this.addHook('beforeDataSplice', (index, amount, element) => this.onBeforeDataSplice(index, amount, element));
    this.addHook('beforeDataFilter', (index, amount, logicRows) => this.onBeforeDataFilter(index, amount, logicRows));
    this.addHook('afterContextMenuDefaultOptions', (defaultOptions) => this.onAfterContextMenuDefaultOptions(defaultOptions));
    this.addHook('afterGetRowHeader', (row, th) => this.onAfterGetRowHeader(row, th));
    this.addHook('beforeOnCellMouseDown', (event, coords, TD) => this.onBeforeOnCellMouseDown(event, coords, TD));
    // this.addHook('beforeDataFilter', (index, amount, logicRows) => this.onBeforeDataFilter(index, amount, logicRows));
    this.addHook('afterRemoveRow', (index, amount) => this.onAfterRemoveRow(index, amount));
    this.addHook('modifyRemovedAmount', (amount, index) => this.onModifyRemovedAmount(amount, index));
    this.addHook('afterInit', () => this.onAfterInit());
    this.addHook('beforeAddChild', (parent, element) => this.onBeforeAddChild(parent, element));
    this.addHook('afterAddChild', (parent, element) => this.onAfterAddChild(parent, element));
    this.addHook('beforeDetachChild', (parent, element) => this.onBeforeDetachChild(parent, element));
    this.addHook('afterDetachChild', (parent, element) => this.onAfterDetachChild(parent, element));
    this.addHook('modifyRowHeaderWidth', (rowHeaderWidth) => this.onModifyRowHeaderWidth(rowHeaderWidth));

    this.addHook('beforeRowMove', (rows, target, blockMoving) => this.onBeforeRowMove(rows, target, blockMoving));
    this.addHook('afterRowMove', (rows, target) => this.onAfterRowMove(rows, target));

    if (!this.trimRowsPlugin.isEnabled()) {
      // Workaround to prevent calling updateSetttings in the enablePlugin method, which causes many problems.
      this.trimRowsPlugin.enablePlugin();
      this.hot.getSettings().trimRows = true;
    }

    if (!this.manualRowsMovePlugin.isEnabled()) {
      // Workaround to prevent calling updateSetttings in the enablePlugin method, which causes many problems.
      this.manualRowsMovePlugin.enablePlugin();
      this.hot.getSettings().manualRowsMovePlugin = true;
    }

    super.enablePlugin();
  }

  /**
   * Disable the plugin.
   */
  disablePlugin() {
    super.disablePlugin();
  }

  /**
   * Update the plugin.
   */
  updatePlugin() {
    this.disablePlugin();
    this.enablePlugin();

    super.updatePlugin();
  }

  onAfterRowMove(rows, target) {
    let priv = privatePool.get(this);

    if (!priv.changeSelection) {
      return;
    }

    let startRow = 0;
    let endRow = 0;
    let rowsLen = rows.length;

    if (priv.movedToParentBegin) {
      priv.movedToParentBegin = false;
      endRow = target;
      startRow = endRow - rowsLen + 1;

    } else {
      if (rows[rowsLen - 1] < target) {
        endRow = this.dataManager.isParent(target) ? target + 1 : target - 1;
        startRow = endRow - rowsLen + 1;

      } else {
        startRow = target;
        endRow = startRow + rowsLen - 1;
      }
    }

    let selection = this.hot.selection;
    let lastColIndex = this.hot.countCols() - 1;

    selection.setRangeStart(new WalkontableCellCoords(startRow, 0));
    selection.setRangeEnd(new WalkontableCellCoords(endRow, lastColIndex), true);

    priv.changeSelection = false;
  }
  onBeforeRowMove(rows, target, blockMoving) {
    blockMoving.rows = true;

    let priv = privatePool.get(this);
    let allowMove = true;
    let rowsLen = rows.length;
    let i;

    for (i = 0; i < rowsLen; i++) {
      if (this.dataManager.isParent(rows[i])) {
        allowMove = false;
      }
    }

    if (rows.indexOf(target) > -1 || !allowMove) {
      return;
    }
    priv.changeSelection = true;

    let fromParent = this.dataManager.getRowParent(rows[0]);
    let toParent = this.dataManager.isParent(target) ? this.dataManager.getDataObject(target) : this.dataManager.getRowParent(target);
    let sameParent = fromParent === toParent;

    if (rows[rowsLen - 1] <= target && sameParent) {
      rows.reverse();
      target--;

    } else if (this.dataManager.isParent(target)) {
      priv.movedToParentBegin = true;
      rows.reverse();
    }

    for (i = 0; i < rowsLen; i++) {
      this.dataManager.moveRow(rows[i], target);
    }

    if ((rows[rowsLen - 1] <= target && sameParent) || this.dataManager.isParent(target)) {
      rows.reverse();
    }

    this.dataManager.rewriteCache();
  }
  /**
   * beforeOnCellMousedown callback
   *
   * @private
   * @param {MouseEvent} event Mousedown event
   * @param {Object} coords Cell coords
   * @param {HTMLElement} TD clicked cell
   */
  onBeforeOnCellMouseDown(event, coords, TD) {
    this.collapsingUI.toggleState(event, coords, TD);
  }

  /**
   * The modifyRowData hook callback.
   *
   * @private
   * @param {Number} row Visual row index.
   */
  onModifyRowData(row) {
    return this.dataManager.getDataObject(row);
  }

  /**
   * Modify the source data length to match the length of the nested structure.
   *
   * @private
   * @returns {number}
   */
  onModifySourceLength() {
    return this.dataManager.countAllRows();
  }

  /**
   * @private
   * @param index
   * @param amount
   * @param element
   * @returns {boolean}
   */
  onBeforeDataSplice(index, amount, element) {
    this.dataManager.spliceData(index, amount, element);

    return false;
  }

  /**
   * Called before the source data filtering. Returning `false` stops the native filtering.
   *
   * @private
   * @param {Number} index
   * @param {Number} amount
   * @param {Array} logicRows
   * @returns {Boolean}
   */
  onBeforeDataFilter(index, amount, logicRows) {
    const realLogicRows = [];
    const startIndex = this.dataManager.translateTrimmedRow(index);

    rangeEach(startIndex, startIndex + amount - 1, (i) => {
      realLogicRows.push(i);
    });

    this.collapsingUI.collapsedRowsStash.stash();
    this.collapsingUI.collapsedRowsStash.trimStash(startIndex, amount);
    this.collapsingUI.collapsedRowsStash.shiftStash(startIndex, (-1) * amount);
    this.dataManager.filterData(index, amount, realLogicRows);

    this.skipRender = true;

    return false;
  }

  /**
   * `afterContextMenuDefaultOptions` hook callback.
   *
   * @private
   * @param defaultOptions
   */
  onAfterContextMenuDefaultOptions(defaultOptions) {
    return this.contextMenuUI.appendOptions(defaultOptions);
  }

  /**
   * `afterGetRowHeader` hook callback.
   *
   * @private
   * @param {Number} row Row index.
   * @param {HTMLElement} TH row header element.
   */
  onAfterGetRowHeader(row, TH) {
    this.headersUI.appendLevelIndicators(row, TH);
  }

  /**
   * `modifyRowHeaderWidth` hook callback.
   *
   * @private
   * @param {Number} rowHeaderWidth The initial row header width(s).
   * @returns {Number}
   */
  onModifyRowHeaderWidth(rowHeaderWidth) {
    return this.headersUI.rowHeaderWidthCache || rowHeaderWidth;
  }

  /**
   * `onAfterRemoveRow` hook callback.
   *
   * @param {Number} index Removed row.
   * @param {Number} amount Amount of removed rows.
   * @private
   */
  onAfterRemoveRow(index, amount) {
    setTimeout(() => {
      this.skipRender = null;
      this.headersUI.updateRowHeaderWidth();
      this.collapsingUI.collapsedRowsStash.applyStash();
    }, 0);
  }

  /**
   * `modifyRemovedAmount` hook callback.
   *
   * @private
   * @param {Number} amount Initial amount.
   * @param {Number} index Index of the starting row.
   * @returns {Number} Modified amount.
   */
  onModifyRemovedAmount(amount, index) {
    let childrenCount = 0;
    let lastParents = [];

    rangeEach(index, index + amount - 1, (i) => {
      let isChild = false;
      let translated = this.collapsingUI.translateTrimmedRow(i);
      let currentDataObj = this.dataManager.getDataObject(translated);

      if (this.dataManager.hasChildren(currentDataObj)) {
        lastParents.push(currentDataObj);

        arrayEach(lastParents, (elem) => {
          if (elem.__children.indexOf(currentDataObj) > -1) {
            isChild = true;
            return false;
          }
        });

        if (!isChild) {
          childrenCount += this.dataManager.countChildren(currentDataObj);
        }
      }

      isChild = false;
      arrayEach(lastParents, (elem) => {
        if (elem.__children.indexOf(currentDataObj) > -1) {
          isChild = true;
          return false;
        }
      });

      if (isChild) {
        childrenCount--;
      }
    });

    return amount + childrenCount;
  }

  /**
   * `beforeAddChild` hook callback.
   *
   * @private
   * @param {Object} parent Parent element.
   * @param {Object} element New child element.
   */
  onBeforeAddChild(parent, element) {
    this.collapsingUI.collapsedRowsStash.stash();
  }

  /**
   * `afterAddChild` hook callback.
   *
   * @private
   * @param {Object} parent Parent element.
   * @param {Object} element New child element.
   */
  onAfterAddChild(parent, element) {
    this.collapsingUI.collapsedRowsStash.shiftStash(this.dataManager.getRowIndex(element));
    this.collapsingUI.collapsedRowsStash.applyStash();

    this.headersUI.updateRowHeaderWidth();
  }

  /**
   * `beforeDetachChild` hook callback.
   *
   * @private
   * @param {Object} parent Parent element.
   * @param {Object} element New child element.
   */
  onBeforeDetachChild(parent, element) {
    this.collapsingUI.collapsedRowsStash.stash();
  }

  /**
   * `afterDetachChild` hook callback.
   *
   * @private
   * @param {Object} parent Parent element.
   * @param {Object} element New child element.
   */
  onAfterDetachChild(parent, element) {
    this.collapsingUI.collapsedRowsStash.shiftStash(this.dataManager.getRowIndex(element));
    this.collapsingUI.collapsedRowsStash.applyStash();

    this.headersUI.updateRowHeaderWidth();
  }

  /**
   * `afterInit` hook callback.
   *
   * @private
   */
  onAfterInit() {
    // Workaround to fix an issue caused by the 'bindRowsWithHeaders' plugin loading before this one.
    if (this.bindRowsWithHeadersPlugin.bindStrategy.strategy) {
      this.bindRowsWithHeadersPlugin.bindStrategy.createMap(this.hot.countSourceRows());
    }

    let deepestLevel = Math.max(...this.dataManager.cache.levels);

    if (deepestLevel > 0) {
      this.headersUI.updateRowHeaderWidth(deepestLevel);
    }
  }

  /**
   * `beforeRender` hook callback.
   *
   * @param force
   * @param skipRender
   * @private
   */
  onBeforeRender(force, skipRender) {
    if (this.skipRender) {
      skipRender.skipRender = true;
    }
  }
}

export {NestedRows};

registerPlugin('nestedRows', NestedRows);
