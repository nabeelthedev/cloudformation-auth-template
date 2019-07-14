const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB()
const https = require('https')
const uuidv1 = require('uuid/v1')

exports.handler = async (event, context) => {
  try {
    console.log('EVENT: ' + JSON.stringify(event))
    console.log('CONTEXT: ' + JSON.stringify(context))

    let clientSecret, parsedClientSecret
    const clientSecrets = process.env.ClientSecrets.split(','),
      clientId = event.ClientId,
      authDomain = process.env.AuthDomain

    for (let i = 0; i < clientSecrets.length; i++) {
      parsedClientSecret = JSON.parse(clientSecrets[i])
      if (parsedClientSecret[clientId]) {
        clientSecret = parsedClientSecret[clientId]
        break
      }
    }

    let token,
      options = {
        hostname: authDomain,
        port: 443,
        path:
          '/oauth2/token?grant_type=authorization_code&client_id' +
          clientId +
          '&code=' +
          event.Code +
          '&redirect_uri=' +
          event.RedirectUri,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(clientId + ':' + clientSecret).toString('base64')
        }
      }

    await new Promise((resolve, reject) => {
      let req = https.request(options, res => {
        let responseBody

        res.on('data', chunk => {
          responseBody += chunk
        })

        res.on('end', () => {
          resolve(responseBody)
        })
      })

      req.on('error', error => {
        reject(error)
      })

      req.end()
    })
      .then(data => {
        token = JSON.parse(data)
      })
      .catch(err => {
        throw err
      })

    if (token.error) {
      throw token
    }

    //store token in sessions db
    //create epoch time for 60 minutes from now
    const ttl = (Math.floor(Date.now() / 1000) + 1 * 60 * 60).toString(),
      uuid = uuidv1()

    let params = {
      Item: {
        id: {
          S: uuid
        },
        token: {
          S: JSON.stringify(token)
        },
        refreshToken: { S: token.refresh_token },
        ttl: {
          N: ttl
        },
        clientId: {
          S: clientId
        },
        LastTokenRefresh: {
          N: Math.floor(Date.now() / 1000).toString()
        }
      },
      TableName: process.env.TableName
    }
    await dynamodb
      .putItem(params)
      .promise()
      .then(data => {})
      .catch(err => {
        throw err
      })
    return { sessionId: uuid }
  } catch (err) {
    console.log(err)
    if (err instanceof Error) {
      err = err.toString()
    } else if (err instanceof Object) {
      err = JSON.stringify(err)
    }
    return err
  }
}
