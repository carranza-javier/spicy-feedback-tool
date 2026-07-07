# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  project = "spicy"

  # All eight route handlers. The JWT authorizer Lambda is declared separately.
  handlers = {
    get_active_exhibition = {
      handler     = "handlers/getActiveExhibition.handler"
      description = "Return the currently active exhibition"
      needs_jwt   = false
    }
    post_response = {
      handler     = "handlers/postResponse.handler"
      description = "Store a visitor response"
      needs_jwt   = false
    }
    login = {
      handler     = "handlers/login.handler"
      description = "Verify credentials and return a JWT"
      needs_jwt   = true
    }
    list_exhibitions = {
      handler     = "handlers/listExhibitions.handler"
      description = "List all exhibitions (admin)"
      needs_jwt   = false
    }
    create_exhibition = {
      handler     = "handlers/createExhibition.handler"
      description = "Create a new exhibition (admin)"
      needs_jwt   = false
    }
    update_exhibition = {
      handler     = "handlers/updateExhibition.handler"
      description = "Edit an exhibition (admin)"
      needs_jwt   = false
    }
    list_responses = {
      handler     = "handlers/listResponses.handler"
      description = "List responses for an exhibition (admin)"
      needs_jwt   = false
    }
    export_responses_csv = {
      handler     = "handlers/exportResponsesCsv.handler"
      description = "Export responses as CSV (admin)"
      needs_jwt   = false
    }
    list_question_templates = {
      handler     = "handlers/listQuestionTemplates.handler"
      description = "List question templates (admin)"
      needs_jwt   = false
    }
    update_question_template = {
      handler     = "handlers/updateQuestionTemplate.handler"
      description = "Edit a question template (admin)"
      needs_jwt   = false
    }
    get_exhibition_by_id = {
      handler     = "handlers/getExhibitionById.handler"
      description = "Return a specific active exhibition"
      needs_jwt   = false
    }
  }
}

# ── Packaging ─────────────────────────────────────────────────────────────────

# Zips the entire backend/src tree; handler paths are relative to that root.
data "archive_file" "lambda_src" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/dist"
  output_path = "${path.module}/lambda.zip"
}

# ── SSM ───────────────────────────────────────────────────────────────────────

data "aws_ssm_parameter" "jwt_secret" {
  name            = var.jwt_secret_ssm_path
  with_decryption = true
}

# ── IAM ───────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.project}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "dynamo_access" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      aws_dynamodb_table.exhibitions.arn,
      aws_dynamodb_table.responses.arn,
      aws_dynamodb_table.admins.arn,
      aws_dynamodb_table.question_templates.arn,
    ]
  }
}

resource "aws_iam_role_policy" "dynamo_access" {
  name   = "${local.project}-dynamo-access"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.dynamo_access.json
}

# ── DynamoDB Tables ───────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "exhibitions" {
  name         = "Exhibitions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "exhibitionId"

  attribute {
    name = "exhibitionId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "responses" {
  name         = "Responses"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "exhibitionId"
  range_key    = "responseId"

  attribute {
    name = "exhibitionId"
    type = "S"
  }

  attribute {
    name = "responseId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "admins" {
  name         = "Admins"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }
}

resource "aws_dynamodb_table" "question_templates" {
  name         = "QuestionTemplates"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "templateId"

  attribute {
    name = "templateId"
    type = "S"
  }
}

# ── CloudWatch Log Groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "handlers" {
  for_each = local.handlers

  name              = "/aws/lambda/${local.project}-${replace(each.key, "_", "-")}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${local.project}-authorizer"
  retention_in_days = var.log_retention_days
}

# ── Lambda: route handlers ────────────────────────────────────────────────────

resource "aws_lambda_function" "handlers" {
  for_each = local.handlers

  function_name    = "${local.project}-${replace(each.key, "_", "-")}"
  description      = each.value.description
  role             = aws_iam_role.lambda_exec.arn
  handler          = each.value.handler
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.lambda_src.output_path
  source_code_hash = data.archive_file.lambda_src.output_base64sha256

  environment {
    variables = merge(
      {
        EXHIBITIONS_TABLE       = aws_dynamodb_table.exhibitions.name
        RESPONSES_TABLE         = aws_dynamodb_table.responses.name
        ADMINS_TABLE            = aws_dynamodb_table.admins.name
        QUESTION_TEMPLATES_TABLE = aws_dynamodb_table.question_templates.name
      },
      each.value.needs_jwt ? { JWT_SECRET = data.aws_ssm_parameter.jwt_secret.value } : {}
    )
  }

  depends_on = [
    aws_cloudwatch_log_group.handlers,
    aws_iam_role_policy_attachment.lambda_basic_logs,
  ]
}

# ── Lambda: authorizer ────────────────────────────────────────────────────────

resource "aws_lambda_function" "authorizer" {
  function_name    = "${local.project}-authorizer"
  description      = "JWT Lambda Authorizer for admin routes"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "authorizer/index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.lambda_src.output_path
  source_code_hash = data.archive_file.lambda_src.output_base64sha256

  environment {
    variables = {
      JWT_SECRET = data.aws_ssm_parameter.jwt_secret.value
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.authorizer,
    aws_iam_role_policy_attachment.lambda_basic_logs,
  ]
}

# ── Lambda invoke permissions ─────────────────────────────────────────────────

resource "aws_lambda_permission" "api_gw_handlers" {
  for_each = local.handlers

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_authorizer" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ── API Gateway HTTP API ──────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.project}-api"
  protocol_type = "HTTP"
  description   = "spicy Kunstraum Feedback Tool API"

  cors_configuration {
    allow_origins = [var.frontend_origin, "http://localhost:4200"]
    allow_methods = ["GET", "POST", "PUT", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

# ── API Gateway: JWT authorizer ───────────────────────────────────────────────

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = aws_apigatewayv2_api.main.id
  name                              = "${local.project}-jwt-authorizer"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  identity_sources                  = ["$request.header.Authorization"]
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = 300
}

# ── API Gateway: integrations (one per handler) ───────────────────────────────

resource "aws_apigatewayv2_integration" "handlers" {
  for_each = local.handlers

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.handlers[each.key].invoke_arn
  payload_format_version = "2.0"
}

# ── API Gateway: routes ───────────────────────────────────────────────────────

# Public — no authorizer

resource "aws_apigatewayv2_route" "get_active_exhibition" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /exhibitions/active"
  target    = "integrations/${aws_apigatewayv2_integration.handlers["get_active_exhibition"].id}"
}

resource "aws_apigatewayv2_route" "post_response" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /responses"
  target    = "integrations/${aws_apigatewayv2_integration.handlers["post_response"].id}"
}

resource "aws_apigatewayv2_route" "login" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.handlers["login"].id}"
}

resource "aws_apigatewayv2_route" "get_exhibition_by_id" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /exhibitions/{exhibitionId}"
  target    = "integrations/${aws_apigatewayv2_integration.handlers["get_exhibition_by_id"].id}"
}

# Admin — JWT authorizer required

resource "aws_apigatewayv2_route" "list_exhibitions" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/exhibitions"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["list_exhibitions"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "create_exhibition" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /admin/exhibitions"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["create_exhibition"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "update_exhibition" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /admin/exhibitions/{exhibitionId}"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["update_exhibition"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "list_responses" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/exhibitions/{exhibitionId}/responses"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["list_responses"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "export_responses_csv" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/exhibitions/{exhibitionId}/responses/csv"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["export_responses_csv"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "list_question_templates" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/question-templates"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["list_question_templates"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "update_question_template" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /admin/question-templates/{templateId}"
  target             = "integrations/${aws_apigatewayv2_integration.handlers["update_question_template"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "CUSTOM"
}
