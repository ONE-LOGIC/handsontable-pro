import {arrayEach} from 'handsontable/helpers/array';
import {rangeEach} from 'handsontable/helpers/number';
import {CellValue} from './cell/value';
import {Stack} from 'handsontable/utils/dataStructures/stack';

/**
 * @class UndoRedoSnapshot
 * @plugin Formulas
 * @pro
 */
class UndoRedoSnapshot {
  constructor(sheet) {
    /**
     * Instance of {@link Sheet}.
     *
     * @type {Sheet}
     */
    this.sheet = sheet;
    /**
     * Stack instance for collecting undo/redo changes.
     *
     * @type {Stack}
     */
    this.stack = new Stack();
  }

  save(axis, index, amount) {
    const {matrix, dataProvider} = this.sheet;
    const changes = [];

    arrayEach(matrix.data, (cellValue) => {
      const {row, column} = cellValue;

      if (cellValue[axis] < index || cellValue[axis] > index + (amount - 1)) {
        const value = dataProvider.getSourceDataAtCell(row, column);

        changes.push({row, column, value});
      }
    });

    this.stack.push({axis, index, amount, changes});
  }

  restore() {
    const {matrix, dataProvider} = this.sheet;
    const {axis, index, amount, changes} = this.stack.pop();

    if (changes) {
      arrayEach(changes, (change) => {
        if (change[axis] > index + (amount - 1)) {
          change[axis] -= amount;
        }
        const {row, column, value} = change;
        const rawValue = dataProvider.getSourceDataAtCell(row, column);

        if (rawValue !== value) {
          dataProvider.updateSourceData(row, column, value);
          matrix.getCellAt(row, column).setState(CellValue.STATE_OUT_OFF_DATE);
        }
      });
    }
  }

  /**
   * Destroy class.
   */
  destroy() {
    this.sheet = null;
    this.stack = null;
  }
}

export {UndoRedoSnapshot};
