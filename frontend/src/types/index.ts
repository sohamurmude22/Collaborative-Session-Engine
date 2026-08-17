export interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp?: string;
  database?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
