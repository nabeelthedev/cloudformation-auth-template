## Description

A CloudFormation template for authentication resources.

This template configures an authentication stack with the following features.

#### Cognito User Pool with Google Sign-In

#### API Gateway with an Authorizer and CORS enabled

#### Web App Firewall with a rate-based rule

#### DynamoDB table with TTL enabled

## Requirements

1. S3 bucket to upload Lambda functions.

## Install

1. `aws cloudformation package --s3-bucket your-bucket --template-file ./template.yaml --output-template-file packaged-template.yaml`
2. `aws cloudformation create-stack --stack-name stack-name --template-body file://packaged-template.yaml --capabilities CAPABILITY_NAMED_IAM --parameters ParameterKey=UserPoolAuthDomain,ParameterValue=auth-domain-name ParameterKey=GraphQLEndpoint,ParameterValue=graphql-endpoint ParameterKey=IdPGoogleId,ParameterValue=your-google-id ParameterKey=IdPGoogleSecret,ParameterValue=your-google-secret ParameterKey=CognitoCallbackURL,ParameterValue=callback-url`

After the stack is created you will need to manually configure the User Pool Domain name (App integration/Domain name via console). This is done manually because custom domain names can take 15 minutes to complete in Cognito.

Fill in parameters above with your information (i.e. _your-bucket_, _domain-name_).
