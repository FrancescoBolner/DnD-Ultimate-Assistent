import { createContext } from 'react';

/**
 * When true, PluginShell renders a transparent wrapper instead of
 * its normal popup / widget chrome.  Used by the Screen plugin to
 * embed other plugins inside screen slots without interfering with
 * the real popup state machine.
 */
export const ScreenEmbedContext = createContext(false);
