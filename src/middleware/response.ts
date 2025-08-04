type JsonResponse<T> = {
  status: number;
  data: T;
  message: string;
};

export const responseJson = <T>(
  status: number,
  data: T,
  message: string,
): JsonResponse<T> => {
  return {
    status,
    data,
    message,
  };
};
