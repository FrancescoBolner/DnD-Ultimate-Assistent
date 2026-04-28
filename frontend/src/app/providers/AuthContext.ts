import { createContext } from 'react';
import type { User } from '../../shared/types';

export interface AuthState {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  loginUser: (identifier: string, password: string) => Promise<void>;
  registerUser: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: {
    username?: string;
    password?: string;
    newPassword?: string;
    avatar?: string;
  }) => Promise<void>;
  impersonateUser: (userId: number) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
