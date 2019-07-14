const AWS = require('aws-sdk')
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider()
const https = require('https')
const url = require('url')

exports.handler = async (event, context) => {
  console.log('EVENT: ' + JSON.stringify(event))
  console.log('CONTEXT: ' + JSON.stringify(context))
  let response = {
      PhysicalResourceId: event.PhysicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {}
    },
    params

  !event.PhysicalResourceId &&
    (response.PhysicalResourceId = 'UserPoolClient-' + Date.now())
  try {
    switch (event.RequestType) {
      case 'Create':
        params = {
          UserPoolId: event.ResourceProperties.UserPoolId,
          AllowedOAuthFlowsUserPoolClient: JSON.parse(
            event.ResourceProperties.AllowedOAuthFlowsUserPoolClient
          ),
          AllowedOAuthFlows: event.ResourceProperties.AllowedOAuthFlows,
          AllowedOAuthScopes: event.ResourceProperties.AllowedOAuthScopes,
          CallbackURLs: event.ResourceProperties.CallbackURLs,
          LogoutURLs: event.ResourceProperties.LogoutURLs,
          SupportedIdentityProviders:
            event.ResourceProperties.SupportedIdentityProviders,
          ClientName: event.ResourceProperties.ClientName,
          GenerateSecret: JSON.parse(event.ResourceProperties.GenerateSecret)
        }

        await cognitoidentityserviceprovider
          .createUserPoolClient(params)
          .promise()
          .then(data => {
            response.Status = 'SUCCESS'
            response.Data.ClientSecret = JSON.stringify({
              [data.UserPoolClient.ClientId]: data.UserPoolClient.ClientSecret
            })
            response.NoEcho = true
            response.PhysicalResourceId =
              'UserPoolClient-' +
              data.UserPoolClient.ClientId +
              '-' +
              event.ResourceProperties.UserPoolId
          })
          .catch(err => {
            response.PhysicalResourceId =
              'FAILED-' + response.PhysicalResourceId
            throw err
          })
        break

      case 'Delete':
        if (event.PhysicalResourceId.split('-')[0] === 'FAILED') {
          response.Status = 'SUCCESS'
          break
        }
        params = {
          ClientId: response.PhysicalResourceId.split('-')[1],
          UserPoolId: event.ResourceProperties.UserPoolId
        }

        await cognitoidentityserviceprovider
          .deleteUserPoolClient(params)
          .promise()
          .then(data => {
            response.Status = 'SUCCESS'
          })
          .catch(err => {
            throw err
          })
        break

      case 'Update':
        params = {
          UserPoolId: event.ResourceProperties.UserPoolId,
          ClientId: response.PhysicalResourceId.split('-')[1],
          AllowedOAuthFlowsUserPoolClient: JSON.parse(
            event.ResourceProperties.AllowedOAuthFlowsUserPoolClient
          ),
          AllowedOAuthFlows: event.ResourceProperties.AllowedOAuthFlows,
          AllowedOAuthScopes: event.ResourceProperties.AllowedOAuthScopes,
          CallbackURLs: event.ResourceProperties.CallbackURLs,
          LogoutURLs: event.ResourceProperties.LogoutURLs,
          SupportedIdentityProviders:
            event.ResourceProperties.SupportedIdentityProviders,
          ClientName: event.ResourceProperties.ClientName
        }

        await cognitoidentityserviceprovider
          .updateUserPoolClient(params)
          .promise()
          .then(data => {
            response.Status = 'SUCCESS'
            response.Data.ClientSecret = JSON.stringify({
              [data.UserPoolClient.ClientId]: data.UserPoolClient.ClientSecret
            })
            response.NoEcho = true
            response.PhysicalResourceId =
              'UserPoolClient-' +
              data.UserPoolClient.ClientId +
              '-' +
              event.ResourceProperties.UserPoolId
          })
          .catch(err => {
            throw err
          })
    }
  } catch (err) {
    response.Status = 'FAILED'
    console.log(err)
    if (err instanceof Error) {
      response.Reason = err.toString()
    } else if (err instanceof Object) {
      response.Reason = JSON.stringify(err)
    } else {
      response.Reason = err
    }
  }

  let responseBody = JSON.stringify(response)
  console.log('RESPONSE BODY: ' + responseBody)

  let parsedUrl = url.parse(event.ResponseURL)
  let options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': Buffer.byteLength(responseBody)
    }
  }

  return new Promise((resolve, reject) => {
    let requestResponse
    let req = https.request(options, res => {
      res.on('data', chunk => {
        requestResponse += chunk
      })
      res.on('end', () => {
        resolve(requestResponse)
      })
    })

    req.on('error', error => {
      reject(error)
    })
    req.write(responseBody)
    req.end()
  })
}
