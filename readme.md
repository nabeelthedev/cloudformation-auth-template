## Description

A CloudFormation template for authentication resources.

## Requirements

1. S3 bucket to upload Lambda functions.

## Install

1. `aws cloudformation package --s3-bucket your-bucket --template-file ./template.yaml --output-template-file packaged-template.yaml`
2. `aws cloudformation create-stack --stack-name stack-name --template-body file://packaged-template.yaml --parameters ParameterKey=UserPoolAuthDomain,ParameterValue=domain-name ParameterKey=GraphQLEndpoint,ParameterValue=graphql-endpoint ParameterKey=IdPGoogleId,ParameterValue=your-google-id ParameterKey=IdPGoogleSecret,ParameterValue=your-google-secret,ParameterValue=CognitoCallbackURL ParameterKey=GraphQLEndpoint,ParameterValue=callback-url`

Fill in parameters above with your information (i.e. _your-bucket_, _domain-name_).
