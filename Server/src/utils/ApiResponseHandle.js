class ApiResponseHandle {
  constructor(statusCode, data, message = 'Success', success = true) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = success;
  }
}

export default ApiResponseHandle;
