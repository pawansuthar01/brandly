import { useDispatch, useSelector } from 'react-redux';
import type { MobileDispatch, MobileRootState } from './store';

export const useMobileDispatch = useDispatch.withTypes<MobileDispatch>();
export const useMobileSelector = useSelector.withTypes<MobileRootState>();
