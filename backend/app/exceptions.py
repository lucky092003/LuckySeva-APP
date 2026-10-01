class ApiError(Exception):
    def __init__(self, status: int, message: str, code: str | None = None):
        self.status = status
        self.message = message
        # Optional stable identifier the client can branch on without parsing the
        # message, e.g. "signup_required".
        self.code = code
        super().__init__(message)