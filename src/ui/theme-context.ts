import { createContext, useContext } from 'react';
import type { ThemeId } from '../shared/themes';

/** Active launcher theme for leaf components (icons, trays) without prop drilling. */
export const LauncherThemeContext = createContext<ThemeId>('sao');
export const useLauncherTheme = (): ThemeId => useContext(LauncherThemeContext);
