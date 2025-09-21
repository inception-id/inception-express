export type Pagination = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export enum WhatsappEnvironment {
  Development = "DEVELOPMENT",
  Production = "PRODUCTION",
}

export enum WhatsappStatus {
  Pending = "PENDING",
  Delivered = "DELIVERED",
  Failed = "FAILED",
}
