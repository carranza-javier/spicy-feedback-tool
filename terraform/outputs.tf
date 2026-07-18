output "api_url" {
  description = "HTTP API invoke URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "exhibitions_table_name" {
  description = "DynamoDB spicy-Exhibitions table name"
  value       = aws_dynamodb_table.exhibitions.name
}

output "responses_table_name" {
  description = "DynamoDB spicy-Responses table name"
  value       = aws_dynamodb_table.responses.name
}

output "admins_table_name" {
  description = "DynamoDB spicy-Admins table name"
  value       = aws_dynamodb_table.admins.name
}

output "question_templates_table_name" {
  description = "DynamoDB spicy-QuestionTemplates table name"
  value       = aws_dynamodb_table.question_templates.name
}
