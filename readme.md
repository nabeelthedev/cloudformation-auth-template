## Description

A CloudFormation template for authentication resources.

This template configures an authentication stack with the following features.

### Cognito User Pool with Google Sign-In

The User Pool manages JSON Web Tokens (JWT) which are used to reference client informatin in an app.

### API Gateway with an Authorizer and CORS enabled

The API Gateway has a _/session_ resource which triggers lambda to return a session ID in exchange for a code it uses to get a JWT. Clients recieve this code after signing in with Google. The client uses the session ID to perform backend actions. Keeping the JWTs on the server-side prevents exposure of client credentials.

The Authorizer will confirm the session ID exists and refresh the JWT if necessary. It will set an Authorization header with the value of the JWT.

CORS is enabled for web apps with a different origin.

### Web App Firewall with a rate-based rule

The Web App Firewall (WAF) has one rate-based rule which temporarily blocks requests from an IP if they exceed a threshold (set to 2000 per 5 minutes). This can be expanded to trigger lambda to add to an IP match condition which would permanently block the attacker. There is a limit of 1000 IPs in a single request so this may not be a long-term solution.

### DynamoDB table with TTL enabled

A table is used to store session IDs and JWTs. Time To Live (TTL) is enabled to remove items stored beyond a certain time (set to 1 hour).

## Requirements

1. S3 bucket to upload Lambda functions.

## Install

1. `aws cloudformation package --s3-bucket your-bucket --template-file ./template.yaml --output-template-file packaged-template.yaml`
2. `aws cloudformation create-stack --stack-name stack-name --template-body file://packaged-template.yaml --capabilities CAPABILITY_NAMED_IAM --parameters ParameterKey=UserPoolAuthDomain,ParameterValue=auth-domain-name ParameterKey=GraphQLEndpoint,ParameterValue=graphql-endpoint ParameterKey=IdPGoogleId,ParameterValue=your-google-id ParameterKey=IdPGoogleSecret,ParameterValue=your-google-secret ParameterKey=CognitoCallbackURL,ParameterValue=callback-url`

Fill in parameters above with your information (i.e. _your-bucket_, _auth-domain-name_). Set the _UserPoolAuthDomain_ to any value if you are not using a custom auth domain and then run _update-stack_ when you've configured the domain name.

After the stack is created you need to manually configure the User Pool Domain name (App integration/Domain name via console). This is done manually because custom domain names can take 15 minutes to complete in Cognito.
