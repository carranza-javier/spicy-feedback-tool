// Development environment.
// The backend runs on Lambda — there is no local API server.
// For local dev, point this at the deployed staging API URL, or use
// a tool like AWS SAM local to run the Lambdas locally.

export const environment = {
  production: false,
  apiBaseUrl: 'https://q72698iyz6.execute-api.eu-central-1.amazonaws.com',
};
