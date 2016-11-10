import {arrayEach} from 'handsontable/helpers/array';

/**
 * Class used to make all endpoint-related operations.
 *
 * @class Endpoints
 * @plugin ColumnSummary
 * @pro
 */
class Endpoints {
  constructor(plugin, settings) {
    /**
     * The main plugin instance.
     */
    this.plugin = plugin;
    /**
     * Handsontable instance.
     *
     * @type {Object}
     */
    this.hot = this.plugin.hot;
    /**
     * Array of declared plugin endpoints (calculation destination points).
     *
     * @type {Array}
     * @default {Array} Empty array.
     */
    this.endpoints = [];
    /**
     * The plugin settings, taken from Handsontable configuration.
     *
     * @type {Object|Function}
     * @default null
     */
    this.settings = settings;
    /**
     * Settings type. Can be either 'array' or 'function.
     *
     * @type {string}
     * @default {'array'}
     */
    this.settingsType = 'array';
    /**
     * The current endpoint (calculation destination point) in question.
     *
     * @type {Object}
     * @default null
     */
    this.currentEndpoint = null;
  }

  /**
   * Get a single endpoint object.
   *
   * @param {Number} index Index of the endpoint.
   * @returns {Object}
   */
  getEndpoint(index) {
    if (this.settingsType === 'function') {
      return this.settings()[index];
    } else {
      return this.endpoints[index];
    }
  }

  /**
   * Get an array with all the endpoints.
   *
   * @returns {Array}
   */
  getAllEndpoints() {
    if (this.settingsType === 'function') {
      return this.settings();
    } else {
      return this.endpoints;
    }
  }

  /**
   * Parse plugin's settings.
   */
  parseSettings() {
    if (typeof this.settings === 'function') {
      this.settingsType = 'function';

      return;
    }

    arrayEach(this.settings, (val) => {
      let newEndpoint = {};

      this.assignSetting(val, newEndpoint, 'ranges', [[0, this.hot.countRows() - 1]]);
      this.assignSetting(val, newEndpoint, 'reversedRowCoords', false);
      this.assignSetting(val, newEndpoint, 'destinationRow', new Error('You must provide a destination row for the Column Summary plugin in order to work properly!'));
      this.assignSetting(val, newEndpoint, 'destinationColumn', new Error('You must provide a destination column for the Column Summary plugin in order to work properly!'));
      this.assignSetting(val, newEndpoint, 'sourceColumn', val.destinationColumn);
      this.assignSetting(val, newEndpoint, 'type', 'sum');
      this.assignSetting(val, newEndpoint, 'forceNumeric', false);
      this.assignSetting(val, newEndpoint, 'suppressDataTypeErrors', true);
      this.assignSetting(val, newEndpoint, 'suppressDataTypeErrors', true);
      this.assignSetting(val, newEndpoint, 'customFunction', null);
      this.assignSetting(val, newEndpoint, 'readOnly', true);
      this.assignSetting(val, newEndpoint, 'roundFloat', false);

      this.endpoints.push(newEndpoint);
    });
  }

  /**
   * Setter for the internal setting objects.
   *
   * @param {Object} settings Object with the settings.
   * @param {Object} endpoint Contains information about the endpoint for the the calculation.
   * @param {String} name Settings name.
   * @param defaultValue Default value for the settings.
   */
  assignSetting(settings, endpoint, name, defaultValue) {
    if (name === 'ranges' && settings[name] === void 0) {
      endpoint[name] = defaultValue;
      return;
    } else if (name === 'ranges' && settings[name].length === 0) {
      return;
    }

    if (settings[name] === void 0) {
      if (defaultValue instanceof Error) {
        throw defaultValue;

      }

      endpoint[name] = defaultValue;

    } else {
      if (name === 'destinationRow' && endpoint.reversedRowCoords) {
        endpoint[name] = this.hot.countRows() - settings[name] - 1;

      } else {
        endpoint[name] = settings[name];
      }
    }
  }

  /**
   * afterCreateRow/afterCreateRow/afterRemoveRow/afterRemoveCol hook callback. Reset and reenables the summary functionality
   * after changing the table structure.
   *
   * @private
   * @param action {String}
   * @param index {Number}
   * @param number {Number}
   * @param createdAutomatically {Boolean}
   */
  resetSetupAfterStructureAlteration(action, index, number, createdAutomatically) {
    if (createdAutomatically || this.settingsType === 'function') {
      return;
    }

    let type = action.indexOf('row') > -1 ? 'row' : 'col';
    let oldEndpoints = deepClone(this.getAllEndpoints());

    arrayEach(oldEndpoints, (val, key, obj) => {
      if (type === 'row' && val.destinationRow >= index) {
        if (action === 'insert_row') {
          val.alterRowOffset = number;
        } else if (action === 'remove_row') {
          val.alterRowOffset = (-1) * number;
        }
      }

      if (type === 'col' && val.destinationColumn >= index) {
        if (action === 'insert_col') {
          val.alterColumnOffset = number;
        } else if (action === 'remove_col') {
          val.alterColumnOffset = (-1) * number;
        }
      }
    });

    this.endpoints = [];
    this.resetAllEndpoints(oldEndpoints);
    this.parseSettings();

    arrayEach(this.getAllEndpoints(), (val, key, obj) => {
      if (type === 'row' && val.destinationRow >= index) {
        if (action === 'insert_row') {
          val.alterRowOffset = number;
        } else if (action === 'remove_row') {
          val.alterRowOffset = (-1) * number;
        }
      }

      if (type === 'col' && val.destinationColumn >= index) {
        if (action === 'insert_col') {
          val.alterColumnOffset = number;
        } else if (action === 'remove_col') {
          val.alterColumnOffset = (-1) * number;
        }
      }
    });

    this.refreshAllEndpoints(true);
  }

  /**
   * Resets (removes) the endpoints from the table.
   *
   * @param {Array} endpoints Array containing the endpoints.
   */
  resetAllEndpoints(endpoints) {
    if (this.settingsType === 'function') {
      return;
    }

    if (!endpoints) {
      endpoints = this.getAllEndpoints();
    }

    arrayEach(endpoints, (value) => {
      this.resetEndpointValue(value);
    });
  }

  /**
   * Calculate and refresh all defined endpoints.
   *
   * @param {Boolean} init `true` if it's the initial call.
   */
  refreshAllEndpoints(init) {
    arrayEach(this.getAllEndpoints(), (value) => {
      this.currentEndpoint = value;
      this.plugin.calculate(value);
      this.setEndpointValue(value, 'init');
    });
    this.currentEndpoint = null;
  }

  /**
   * Calculate and refresh endpoints only in the changed columns.
   *
   * @param {Array} changes Array of changes from the `afterChange` hook.
   */
  refreshChangedEndpoints(changes) {
    let needToRefresh = [];

    arrayEach(changes, (value, key, changes) => {
      // if nothing changed, dont update anything
      if ((value[2] || '') + '' === value[3] + '') {
        return;
      }

      arrayEach(this.getAllEndpoints(), (value, j) => {
        if (this.hot.propToCol(changes[key][1]) === value.sourceColumn && needToRefresh.indexOf(j) === -1) {
          needToRefresh.push(j);
        }
      });
    });

    arrayEach(needToRefresh, (value) => {
      this.refreshEndpoint(this.getEndpoint(value));
    });
  }

  /**
   * Calculate and refresh a single endpoint.
   *
   * @param {Object} endpoint Contains the endpoint information.
   */
  refreshEndpoint(endpoint) {
    this.currentEndpoint = endpoint;
    this.calculate(endpoint);
    this.setEndpointValue(endpoint);
    this.currentEndpoint = null;
  }

  /**
   * Reset the endpoint value.
   *
   * @param {Object} endpoint Contains the endpoint information.
   */
  resetEndpointValue(endpoint) {
    let alterRowOffset = endpoint.alterRowOffset || 0;
    let alterColOffset = endpoint.alterColumnOffset || 0;

    if (endpoint.destinationRow + alterRowOffset > this.hot.countRows() ||
      endpoint.destinationColumn + alterColOffset > this.hot.countCols()) {
      this.throwOutOfBoundsWarning();
      return;
    }

    this.hot.setCellMeta(endpoint.destinationRow, endpoint.destinationColumn, 'readOnly', false);
    this.hot.setCellMeta(endpoint.destinationRow, endpoint.destinationColumn, 'className', '');
    this.hot.setDataAtCell(endpoint.destinationRow + alterRowOffset, endpoint.destinationColumn + alterColOffset, '', 'columnSummary');
  }

  /**
   * Set the endpoint value.
   *
   * @param {Object} endpoint Contains the endpoint information.
   * @param {String} [source] Source of the call information.
   */
  setEndpointValue(endpoint, source) {
    let alterRowOffset = endpoint.alterRowOffset || 0;
    let alterColumnOffset = endpoint.alterColumnOffset || 0;

    let rowOffset = Math.max(-alterRowOffset, 0);
    let colOffset = Math.max(-alterColumnOffset, 0);

    if (endpoint.destinationRow + rowOffset > this.hot.countRows() ||
      endpoint.destinationColumn + colOffset > this.hot.countCols()) {
      this.throwOutOfBoundsWarning();
      return;
    }

    if (source === 'init') {
      this.hot.setCellMeta(endpoint.destinationRow + rowOffset, endpoint.destinationColumn + colOffset, 'readOnly', endpoint.readOnly);
      this.hot.setCellMeta(endpoint.destinationRow + rowOffset, endpoint.destinationColumn + colOffset, 'className', 'columnSummaryResult');
    }

    if (endpoint.roundFloat && !isNaN(endpoint.result)) {
      endpoint.result = endpoint.result.toFixed(endpoint.roundFloat);
    }

    this.hot.setDataAtCell(endpoint.destinationRow, endpoint.destinationColumn, endpoint.result, 'columnSummary');

    endpoint.alterRowOffset = void 0;
    endpoint.alterColOffset = void 0;
  }

  /**
   * Throw an error for the calculation range being out of boundaries.
   *
   * @private
   */
  throwOutOfBoundsWarning() {
    console.warn('One of the  Column Summary plugins\' destination points you provided is beyond the table boundaries!');
  }
}

export {Endpoints};
