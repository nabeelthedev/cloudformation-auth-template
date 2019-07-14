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
    (response.PhysicalResourceId =
      'UserPoolIdP-' + event.ResourceProperties.UserPoolId + '-' + Date.now())
  try {
    switch (event.RequestType) {
      case 'Create':
        params = {
          ProviderName: event.ResourceProperties.ProviderName,
          ProviderType: event.ResourceProperties.ProviderType,
          UserPoolId: event.ResourceProperties.UserPoolId,
          ProviderDetails: event.ResourceProperties.ProviderDetails,
          AttributeMapping: event.ResourceProperties.AttributeMapping
        }

        await cognitoidentityserviceprovider
          .createIdentityProvider(params)
          .promise()
          .then(data => {
            response.Status = 'SUCCESS'
            response.Data = data
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
          ProviderName: event.ResourceProperties.ProviderName,
          UserPoolId: event.ResourceProperties.UserPoolId
        }

        await cognitoidentityserviceprovider
          .deleteIdentityProvider(params)
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
          ProviderName: event.ResourceProperties.ProviderName,
          UserPoolId: event.ResourceProperties.UserPoolId,
          ProviderDetails: event.ResourceProperties.ProviderDetails,
          AttributeMapping: event.ResourceProperties.AttributeMapping
        }

        await cognitoidentityserviceprovider
          .updateIdentityProvider(params)
          .promise()
          .then(data => {
            response.Status = 'SUCCESS'
            response.Data = data
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
