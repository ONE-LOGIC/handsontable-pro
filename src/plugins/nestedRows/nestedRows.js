import BasePlugin from 'handsontable/plugins/_base';
import {registerPlugin} from 'handsontable/plugins';
import {rangeEach} from 'handsontable/helpers/number';
import {arrayEach} from 'handsontable/helpers/array';
import {DataManager} from './data/dataManager';
import {CollapsingUI} from './ui/collapsing';
import {HeadersUI} from './ui/headers';
import {ContextMenuUI} from './ui/contextMenu';

/**
 * @plugin NestedRows
 *
 *
 * @description
 * Blank plugin template. It needs to inherit from the BasePlugin class.
 * @dependencies TrimRows, BindRowsWithHeaders
 */
class NestedRows extends BasePlugin {

  constructor(hotInstance) {

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
    this.bindRowsWithHeadersPlugin = this.hot.getPlugin('bindRowsWithHeaders');

    this.dataManager = new DataManager(this, this.hot, this.sourceData);
    this.collapsingUI = new CollapsingUI(this, this.hot, this.trimRowsPlugin);
    this.headersUI = new HeadersUI(this, this.hot);
    this.contextMenuUI = new ContextMenuUI(this, this.hot);

    this.dataManager.rewriteCache();

    this.addHook('modifyRowData', (row) => this.onModifyRowData(row));
    this.addHook('modifySourceLength', () => this.onModifySourceLength());
    this.addHook('beforeDataSplice', (index, amount, element) => this.onBeforeDataSplice(index, amount, element));
    this.addHook('beforeDataFilter', (index, amount, logicRows) => this.onBeforeDataFilter(index, amount, logicRows));
    this.addHook('afterContextMenuDefaultOptions', (defaultOptions) => this.onAfterContextMenuDefaultOptions(defaultOptions));
    this.addHook('afterGetRowHeader', (row, th) => this.onAfterGetRowHeader(row, th));
    this.addHook('beforeOnCellMouseDown', (event, coords, TD) => this.onBeforeOnCellMouseDown(event, coords, TD));
    this.addHook('beforeRemoveRow', (index, amount) => this.onBeforeRemoveRow(index, amount));
    this.addHook('modifyRemovedAmount', (amount, index) => this.onModifyRemovedAmount(amount, index));
    this.addHook('afterInit', () => this.onAfterInit());
    this.addHook('afterAddChild', () => this.headersUI.updateRowHeaderWidth());
    this.addHook('afterDetachChild', () => this.headersUI.updateRowHeaderWidth());
    this.addHook('modifyRowHeaderWidth', (rowHeaderWidth) => this.onModifyRowHeaderWidth(rowHeaderWidth));

    if (!this.trimRowsPlugin.isEnabled()) {

      // Workaround to prevent calling updateSetttings in the enablePlugin method, which causes many problems.
      this.trimRowsPlugin.enablePlugin();
      this.hot.getSettings().trimRows = true;
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
    this.dataManager.filterData(index, amount, logicRows);

    return false;
  }

  /**
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
   * `beforeRemoveRow` hook callback.
   *
   * @param {Number} index Removed row.
   * @param {Number} amount Amount of removed rows.
   * @private
   */
  onBeforeRemoveRow(index, amount) {
    index = this.collapsingUI.translateTrimmedRow(index);
    if (index != null) {
      const rowsToRemove = [];
      rangeEach(index, index + amount - 1, (i) => {
        rowsToRemove.push(i);
      });

      this.collapsingUI.expandRows(rowsToRemove);
    }
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
}

export {NestedRows};

registerPlugin('nestedRows', NestedRows);
