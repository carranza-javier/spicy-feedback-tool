// Production environment.
// Set apiBaseUrl to the API Gateway invoke URL after the first terraform apply
// (run `terraform output api_url` to get the value).

export const environment = {
  production: true,
  apiBaseUrl: 'https://q72698iyz6.execute-api.eu-central-1.amazonaws.com',
};
