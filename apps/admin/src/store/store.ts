import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AdminUiState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  notificationsOpen: boolean;
}

const initialState: AdminUiState = {
  theme: 'light',
  sidebarCollapsed: false,
  notificationsOpen: false,
};

const uiSlice = createSlice({
  name: 'adminUi',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<AdminUiState['theme']>) => { state.theme = action.payload; },
    toggleSidebar: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed; },
    setNotificationsOpen: (state, action: PayloadAction<boolean>) => { state.notificationsOpen = action.payload; },
  },
});

export const { setTheme, toggleSidebar, setNotificationsOpen } = uiSlice.actions;

export const adminStore = configureStore({ reducer: { ui: uiSlice.reducer } });
export type AdminRootState = ReturnType<typeof adminStore.getState>;
export type AdminDispatch = typeof adminStore.dispatch;
