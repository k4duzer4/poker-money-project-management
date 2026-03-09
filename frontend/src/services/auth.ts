import { AxiosError } from 'axios';

import api from './http';
import type { User } from '../types/domain';

export type LoginPayload = {
  email: string;
  password: string;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }

  return fallback;
};

export const loginRequest = async (payload: LoginPayload) => {
  try {
    const { data } = await api.post<{ token: string }>('/auth/login', payload);
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Falha ao fazer login.'));
  }
};

export const registerRequest = async (payload: LoginPayload) => {
  try {
    const { data } = await api.post<{ id: string; email: string; createdAt: string }>(
      '/auth/register',
      payload,
    );
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Falha ao registrar usuário.'));
  }
};

export const meRequest = async () => {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
};
