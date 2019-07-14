const AWS = require('aws-sdk')
const wafregional = new AWS.WAFRegional()
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
    (response.PhysicalResourceId = 'WAFWebACLUpdateRule-' + Date.now())
  try {
    let changeToken
    await wafregional
      .getChangeToken()
      .promise()
      .then(data => {
        changeToken = data.ChangeToken
      })
      .catch(err => {
        throw err
      })

    switch (event.RequestType) {
      case 'Create':
        params = {
          ChangeToken: changeToken,
          WebACLId: event.ResourceProperties.WebACLId,
          Updates: event.ResourceProperties.Updates
        }

        for (let i = 0; i < params.Updates.length; i++) {
          params.Updates[i].Action = 'INSERT'
        }

        await wafregional
          .updateWebACL(params)
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
          ChangeToken: changeToken,
          WebACLId: event.ResourceProperties.WebACLId,
          Updates: event.ResourceProperties.Updates
        }

        for (let i = 0; i < params.Updates.length; i++) {
          params.Updates[i].Action = 'DELETE'
        }

        await wafregional
          .updateWebACL(params)
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
          ChangeToken: changeToken,
          WebACLId: event.ResourceProperties.WebACLId,
          Updates: []
        }

        for (let i = 0; i < event.OldResourceProperties.Updates.length; i++) {
          event.OldResourceProperties.Updates[i].Action = 'DELETE'
          params.Updates.push(event.OldResourceProperties.Updates[i])
        }
        for (let i = 0; i < event.ResourceProperties.Updates.length; i++) {
          event.ResourceProperties.Updates[i].Action = 'INSERT'
          params.Updates.push(event.ResourceProperties.Updates[i])
        }

        await wafregional
          .updateWebACL(params)
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
