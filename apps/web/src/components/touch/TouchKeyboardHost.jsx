import React from 'react';
import { useTouchMode } from '../../context/TouchModeContext';
import TouchVirtualKeyboard from './TouchVirtualKeyboard';

/** Monte le clavier virtuel sans import circulaire avec TouchModeProvider */
export default function TouchKeyboardHost() {
  const { touchMode } = useTouchMode();
  if (!touchMode) return null;
  return <TouchVirtualKeyboard />;
}
