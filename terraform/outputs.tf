output "api_url" {
  description = "HTTP API invoke URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "exhibitions_table_name" {
  description = "DynamoDB Exhibitions table name"
  value       = aws_dynamodb_table.exhibitions.name
}

output "responses_table_name" {
  description = "DynamoDB Responses table name"
  value       = aws_dynamodb_table.responses.name
}

output "admins_table_name" {
  description = "DynamoDB Admins table name"
  value       = aws_dynamodb_table.admins.name
}

output "question_templates_table_name" {
  description = "DynamoDB QuestionTemplates table name"
  value       = aws_dynamodb_table.question_templates.name
}
