const FoxyWebhook = require("../../foxy/FoxyWebhook.js");
const webhook = require("./webhook.js");
const { config } = require("../../../config.js");

/**
 * @callback requestCallback
 * @param {}
 */

/**
 * Receives the request, process it and invokes the callback.
 *
 * @param {Object} requestEvent the event built by Netlify upon receiving the request.
 * @returns {Promise<{statusCode: number, body: string}>} the response object
 */
async function handler(requestEvent) {
  // Validate environment variables are set, sends 503 if not set
  if (!validation.configuration.validate()) {
    return validation.configuration.response();
  }

  // Don't attempt validate GET requests, just return
  if (requestEvent.httpMethod === 'GET') {
    console.log("Responded to GET request and returned 200")
    return GetRequest;
  }

  // Validate and authenticate that input is valid
  // Otherwise, sends 200, error message, and prints request in logs
  const inputError = validation.input.getError(requestEvent); 
  if (inputError) {
    return validation.input.response(inputError);
  }
  const foxyEvent = requestEvent.headers['foxy-webhook-event'];
  let response;
  const body = JSON.parse(requestEvent.body);
  switch (foxyEvent) {
    case 'validation/payment':
      response = webhook.prePayment(body);
      break;
    case 'transaction/created':
      response = webhook.transactionCreated(body);
      break;
    default:
      // If transaction not found, sends 200, Bad Request and logs
      response = BadRequest;
  }

  // Log if BadRequest
  if (response == BadRequest) {
    console.log(requestEvent);
    console.error("event: " + foxyEvent);
    console.error("BadRequest: ");
  }

  return response;
}

/**
 * @typedef {Object} Validation
 * @property {Function} response a function that builds the response
 * @property {Function} validate a function that is used to validate
 */

// The validation object is used to aggregate validation functions
// and responses.
// @type {Object<string, Validation>}
const validation = {
  configuration: {
    response: () => webhook.response(
      "Service Unavailable. Check the webhook error logs.",
      503
    )
    ,
    validate: () => {
      const credentials = config.datastore.provider.orderDesk;
      if (!credentials.storeId) {
        console.error("FOXY_ORDERDESK_STORE_ID is not configured");
      }
      if (!credentials.apiKey) {
        console.error("FOXY_ORDERDESK_API_KEY is not configured");
      }
      return credentials.storeId && credentials.apiKey;
    },
  },
  input: {
    errorMessage: "Default Bad Request",
    getError: FoxyWebhook.validFoxyRequest,
    response: (message) => webhook.response(message, 200),
  }

};

const GetRequest = webhook.response('GET Request', 200);
const BadRequest = webhook.response('Bad Request', 200);

module.exports = {
  handler
}
