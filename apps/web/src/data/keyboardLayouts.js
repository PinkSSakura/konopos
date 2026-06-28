/** Dispositions clavier virtuel — mode tactile */

export const KEYBOARD_LANG = {
  FR: 'fr',
  AR: 'ar',
  DIGITS: 'digits',
};

export const KEYBOARD_LAYOUTS = {
  [KEYBOARD_LANG.FR]: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n', ',', '.', '-', "'"],
    ['@'],
  ],
  [KEYBOARD_LANG.FR + '_shift']: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['W', 'X', 'C', 'V', 'B', 'N', '?', '!', '_', '"'],
    ['@'],
  ],
  [KEYBOARD_LANG.AR]: [
    ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
    ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
    ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'],
    ['د', 'ذ', '.', '،', '؟', '!'],
  ],
  [KEYBOARD_LANG.DIGITS]: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['+', '-', '*', '/', '=', '%', '(', ')', '.', ','],
    ['@', '#', '&', ':', ';', '"', "'", '?', '!'],
  ],
};

export const LANG_LABELS = [
  { key: KEYBOARD_LANG.FR, label: 'FR' },
  { key: KEYBOARD_LANG.AR, label: 'ع' },
  { key: KEYBOARD_LANG.DIGITS, label: '123' },
];
