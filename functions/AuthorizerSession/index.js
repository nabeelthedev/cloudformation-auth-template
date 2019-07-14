const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB()
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider()

exports.handler = async (event, context, callback) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2))

    // A simple request-based authorizer example to demonstrate how to use request
    // parameters to allow or deny a request. In this example, a request is
    // authorized if the client-supplied HeaderAuth1 header, QueryString1
    // query parameter, and stage variable of StageVar1 all match
    // specified values of 'headerValue1', 'queryValue1', and 'stageValue1',
    // respectively.

    // Retrieve request parameters from the Lambda function input:
    let headers = event.headers
    !headers.SessionId ? (headers.SessionId = event.headers.sessionid) : false
    // var queryStringParameters = event.queryStringParameters
    // var pathParameters = event.pathParameters
    // var stageVariables = event.stageVariables
    // var body = event.body

    // Parse the input for the parameter values
    let tmp = event.methodArn.split(':')
    let apiGatewayArnTmp = tmp[5].split('/')
    // var awsAccountId = tmp[4]
    // var region = tmp[3]
    // var restApiId = apiGatewayArnTmp[0]
    // var stage = apiGatewayArnTmp[1]
    // var method = apiGatewayArnTmp[2]
    let resource = '/' // root resource
    if (apiGatewayArnTmp[3]) {
      resource += apiGatewayArnTmp[3]
    }

    // Perform authorization to return the Allow policy for correct parameters and
    // the 'Unauthorized' error, otherwise.

    // var condition = {}
    // condition.IpAddress = {}

    // if (headers.HeaderAuth1 === "headerValue1"
    //     && queryStringParameters.QueryString1 === "queryValue1"
    //     && stageVariables.StageVar1 === "stageValue1") {
    //     callback(null, generateAllow('me', event.methodArn));
    // }  else {
    //     callback("Unauthorized");
    // }

    // look up sessionid
    let refreshToken,
      token = {},
      clientId,
      lastTokenRefresh,
      params = {
        Key: {
          id: {
            S: headers.SessionId
          }
        },
        TableName: process.env.TableName
      }
    console.log('GET PARAMS: ' + JSON.stringify(params))
    await dynamodb
      .getItem(params)
      .promise()
      .then(data => {
        console.log(data)
        // token
        if (data.Item) {
          refreshToken = data.Item.refreshToken.S
          clientId = data.Item.clientId.S
          token = JSON.parse(data.Item.token.S)
          lastTokenRefresh = data.Item.LastTokenRefresh.N
        } else {
          // invalid session id
          throw 'Session Id not found.'
        }
      })
      .catch(err => {
        throw err
      })
    // if last time token was refereshed was less than 55 minutes ago, refresh the session TTL and allow
    if (
      lastTokenRefresh &&
      Math.floor(Date.now() / 1000) - lastTokenRefresh < 55 * 60
    ) {
      // refresh session ttl
      const ttl = (Math.floor(Date.now() / 1000) + 1 * 60 * 60).toString()
      let params = {
        ExpressionAttributeNames: {
          '#TTL': 'ttl'
        },
        ExpressionAttributeValues: {
          ':t': {
            S: ttl
          }
        },
        Key: {
          id: {
            S: headers.SessionId
          }
        },
        TableName: process.env.TableName,
        UpdateExpression: 'SET #TTL = :t'
      }
      console.log(params)
      // dont await for update. this will decrease response time to user.
      dynamodb
        .updateItem(params)
        .promise()
        .then(data => {})
        .catch(err => {
          console.log(err)
        })
      return generateAllow(headers.SessionId, event.methodArn, token.id_token)
    }
    // refresh token and store session information
    let clientSecret,
      clientSecrets = process.env.ClientSecrets.split(','),
      parsedClientSecret
    for (let i = 0; i < clientSecrets.length; i++) {
      parsedClientSecret = JSON.parse(clientSecrets[i])
      if (parsedClientSecret[clientId]) {
        clientSecret = parsedClientSecret[clientId]
        break
      }
    }

    let params = {
      AuthFlow: 'REFRESH_TOKEN',
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: clientSecret
      }
    }
    console.log('INITIATE AUTH PARAMS: ' + JSON.stringify(params))
    //refresh token
    await cognitoidentityserviceprovider
      .initiateAuth(params)
      .promise()
      .then(data => {
        console.log(data)
        if (!data) {
          throw 'Failed to refresh token.'
        }
        token.id_token = data.AuthenticationResult.IdToken
        token.expires_in = data.AuthenticationResult.ExpiresIn
        token.access_token = data.AuthenticationResult.AccessToken
        token.token_type = data.AuthenticationResult.TokenType
      })
      .catch(err => {
        throw err
      })

    //store new token
    const ttl = (Math.floor(Date.now() / 1000) + 1 * 60 * 60).toString()
    let params = {
      Item: {
        id: {
          S: headers.SessionId
        },
        token: {
          S: JSON.stringify(token)
        },
        refreshToken: {
          S: refreshToken
        },
        clientId: {
          S: clientId
        },
        ttl: {
          N: ttl
        },
        LastTokenRefresh: {
          N: Math.floor(Date.now() / 1000).toString()
        }
      },
      TableName: process.env.TableName
    }
    console.log(params)
    await dynamodb
      .putItem(params)
      .promise()
      .then(data => {})
      .catch(err => {
        throw err
      })

    if (token.id_token) {
      // return generateAllow('me', event.methodArn, token)
      // callback(null, generateAllow('me', event.methodArn, token.id_token))
      return generateAllow(headers.SessionId, event.methodArn, token.id_token)
    } else {
      throw 'Missing token.'
    }
  } catch (err) {
    console.log(err)
    return generateDeny(headers.SessionId, event.methodArn)
  }
}

// Help function to generate an IAM policy
const generatePolicy = (principalId, effect, resource, token) => {
  // Required output:
  let authResponse = {}
  authResponse.principalId = principalId
  if (effect && resource) {
    let policyDocument = {}
    policyDocument.Version = '2012-10-17' // default version
    policyDocument.Statement = []
    let statementOne = {}
    statementOne.Action = 'execute-api:Invoke' // default action
    statementOne.Effect = effect
    statementOne.Resource = resource
    policyDocument.Statement[0] = statementOne
    authResponse.policyDocument = policyDocument
  }
  // Optional output with custom properties of the String, Number or Boolean type.
  if (effect === 'Allow') {
    authResponse.context = {
      Authorization: token
    }
  }

  return authResponse
}

const generateAllow = (principalId, resource, token) => {
  return generatePolicy(principalId, 'Allow', resource, token)
}

const generateDeny = (principalId, resource, token) => {
  return generatePolicy(principalId, 'Deny', resource, token)
}
