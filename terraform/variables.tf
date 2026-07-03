variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Deployment environment (prod, staging)"
  type        = string
  default     = "prod"
}

variable "frontend_origin" {
  description = "Allowed CORS origin (the feedback subdomain)"
  type        = string
  default     = "https://feedback.spicy-kunstraum.ch"
}

variable "jwt_secret_ssm_path" {
  description = "SSM Parameter Store path holding the JWT signing secret"
  type        = string
  default     = "/spicy/jwt-secret"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}
