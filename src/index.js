'use strict';

const _ = require( 'lodash' );
const AWS = require( 'aws-sdk' );
const Promise = require( 'bluebird' );
const request = require( 'request-promise' );
const urlLib = require( 'url' );

function createElasticSearchClient( 
		awsRegion,
		awsCredentials
	) {

	return ( req ) => {

		const esUrlInfo = urlLib.parse( req.url );
		const esClusterUrl = urlLib.resolve( req.url, '/' );

		const signingReq = new AWS.HttpRequest( esClusterUrl );
		signingReq.method = req.method;
		signingReq.path = esUrlInfo.path;
		signingReq.region = awsRegion;

		if( !signingReq.headers ) {
			signingReq.headers = {};
		}
		signingReq.headers.Host = esUrlInfo.hostname;

		const signer = new AWS.Signers.V4( signingReq, 'es' );
		signer.addAuthorization( awsCredentials, new Date() );

		if( !req.headers ) {
			req.headers = {};
		}

		_.forIn( signingReq.headers, ( value, key ) => {
			req.headers[ key ] = value;
		} );

		return request( req );
	};
}

function getAwsCredentialsProviderAsync() {

	return new Promise( ( resolve, reject ) => {

		const chain = new AWS.CredentialProviderChain();
		chain.resolve( ( resolveErr, provider ) => {

			if( resolveErr ) {
				return reject( resolveErr );
			}

			return provider.get( getErr => {

				if( getErr ) {
					return reject( getErr );
				}
				
				return resolve( provider );
			} );
		} );
	} );
}

module.exports = function( awsRegion, httpMethod, elasticsearchUrl, bodyJson ) {

	return getAwsCredentialsProviderAsync()
		.then( awsCredentials => {
			
			const esClient = createElasticSearchClient(
					awsRegion,
					awsCredentials
				);

			return esClient( {
					method: httpMethod,
					url: elasticsearchUrl,
					json: bodyJson || true
				} );
		} );
};
