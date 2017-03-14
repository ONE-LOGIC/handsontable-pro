import {startsWith} from 'handsontable/helpers/string';
import {stringify} from 'handsontable/helpers/mixed';
import {registerFormula} from './../formulaRegisterer';

export const FORMULA_NAME = 'begins_with';

export function formula(dataRow, [value] = inputValues) {
  return startsWith(stringify(dataRow.value).toLowerCase(), stringify(value));
}

registerFormula(FORMULA_NAME, formula, {
  name: 'Begins with',
  inputsCount: 1
});
