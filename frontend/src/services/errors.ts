import { AxiosError } from 'axios';

export const getApiErrorMessage = (error: unknown, fallback = 'Erro inesperado.') => {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
