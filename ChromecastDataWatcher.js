const process = require( "process" );
const path = require( "path" );
const exec = require( "child_process" ).exec;

const global_package_path = process.argv[ 0 ].split( "/bin/node" )[ 0 ] + "/lib/node_modules";
const castv2 = require( path.join( global_package_path ,  "castv2-client" ) );
const events = require( path.join( global_package_path ,  "events" ) );
const RMU = require( path.join( global_package_path , "redis-manager-utils" ) );
const bent = require( path.join( global_package_path , "bent" ) );

// const castv2 = require(  "castv2-client" );
// const events = require( "events" );
// const RMU = require( "redis-manager-utils" );
// const bent = require( "bent" );

function sleep( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }

// https://github.com/thibauts/node-castv2-client/blob/a083b71f747557c1f3d5411abe7142e186ed9732/lib/senders/default-media-receiver.js#L6
// https://github.com/mafintosh/chromecasts/blob/master/index.js#L73

let redis_manager;
let EventEmitter;

function REBOOT_DOCKER() {
	try {
		exec( "reboot -f" , ( error , stdout , stderr ) => {
			console.log( stdout );
		});
	}
	catch( error ) { console.log( error ); reject( error ); return; }
}

function RedisConnect() {
	return new Promise( async ( resolve , reject ) => {
		try {
			redis_manager = new RMU( 1 );
			await redis_manager.init();
			resolve();
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function RedisPushPopToCircularListLength100( key , db_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			await redis_manager.listRPUSH( key , db_object );
			let list_length = await redis_manager.listGetLength( key );
			list_length = parseInt( list_length );
			if ( list_length > 100 ) {
				await redis_manager.listLPOP( key );
			}
			resolve();
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function BuildTrackingObjectsFromUUDIS() {
	return new Promise( async ( resolve , reject ) => {
		try {
			const UUID_Keys = await redis_manager.keysGetFromPattern( "UUIDS.*" );
			let tracking_objects = [];
			for ( let i = 0; i < UUID_Keys.length; ++i ) {
				let uuid_info = await redis_manager.keyGet( UUID_Keys[ i ] );
				uuid_info = JSON.parse( uuid_info );
				tracking_objects.push({
					uuid_redis_key: UUID_Keys[ i ] ,
					uuid_info: uuid_info ,
					session: false ,
					latest_status: false ,
				});
			}
			resolve( tracking_objects );
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function RedisPublishStatus( key , db_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			await redis_manager.keySet( key , db_object );
			await redis_manager.redis.publish( "STATUS-MEDIA" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function connect_to_ip( client , chromecast_ip ) {
	return new Promise( ( resolve , reject ) => {
		try {
			client.connect( chromecast_ip , ( err ) => {
				if ( err ) { console.log( err ); resolve( false ); return; }
				resolve( true );
				return;
			});
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function get_sessions( client ) {
	return new Promise( ( resolve , reject ) => {
		try {
			client.getSessions( ( err , sessions ) => {
				if ( err ) { console.log( err ); resolve( false ); return; }
				resolve( sessions );
				return;
			});
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function join_session( client , session ) {
	return new Promise( ( resolve , reject ) => {
		try {
			client.join( session , castv2.DefaultMediaReceiver , ( err , player ) => {
				if ( err ) { console.log( err ); resolve( false ); return; }
				resolve( player );
				return;
			});
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function get_status( player ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			player.getStatus( ( err , status ) => {
				if ( err ) { console.log( err ); resolve( false ); return; }
				resolve( status );
				return;
			});
			setTimeout( () => {
				resolve( false );
			} , 2000 );
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

// PepeHands https://github.com/request/request/issues/3143
// monkaHmm  https://github.com/mikeal/bent

function save_status( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			const app_id = tracking_object[ "session" ][ "appId" ];
			const app_name = tracking_object[ "session" ][ "displayName" ].toLowerCase();
			console.log( `App ID: ${ app_id }` );
			console.log( `App Name == ${ app_name }` );
			let db_object = { app_id: app_id , app_name: app_name , status: tracking_object.latest_status };
			if ( app_name === "spotify" ) {
				if ( !!db_object.status.playerState ) {
					if ( db_object.status.playerState.toLowerCase() == "paused" ) {
						const htttp_request = bent( 'http://127.0.0.1:9797/commands/spotify-paused' );
						console.log( htttp_request.status );
						console.log( htttp_request.statusCode );
						const http_result = await htttp_request.text();
						console.log( http_result );
					}
				}
			}
			console.log( db_object );
			db_object = JSON.stringify( db_object );
			const redis_key = `APPS.GENERIC.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;
			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

async function one_hot_join_session_zero_and_listen_for_statuses( tracking_object ) {
	try {
		console.log( `resetting up chomecast listener on ${ tracking_object[ "uuid_info" ][ "ip" ] }` )
		const client = new castv2.Client();
		const connected = await connect_to_ip( client , tracking_object[ "uuid_info" ][ "ip" ] );
		if ( !connected ) { return; }
		const sessions = await get_sessions( client );
		console.log( sessions );
		if ( !sessions ) {
			console.log( "No Sessions Found" );
			//REBOOT_DOCKER(); ??
			EventEmitter.emit( "player-closed" , tracking_object );
			return false;
		}
		if ( sessions.length < 1 ) {
			console.log( "No Sessions Found" );
			EventEmitter.emit( "player-closed" , tracking_object );
			return false;
		}
		console.log( "we got the session" );
		tracking_object[ "session" ] = sessions[ 0 ];
		const player = await join_session( client , tracking_object[ "session" ] );
		if ( !player ) {
			console.log( "No Player Found" );
			EventEmitter.emit( "player-closed" , tracking_object );
			return false;
		}
		console.log( "we got the player" );

		if ( tracking_object[ "session" ].statusText ) {
			if ( tracking_object[ "session" ].statusText.length > 0 ) {
				const initial_status = await get_status( player );
				if ( initial_status ) {
					// console.log( "iinitial status === " );
					// console.log( initial_status );
					tracking_object[ "latest_status" ] =  initial_status;
					await save_status( tracking_object );
				}
			}
		}

		player.on( "status" , async ( status ) => {
			//console.log( status );
			tracking_object[ "latest_status" ] = status;
			await save_status( tracking_object );
		});

		player.on( "close" , () => {
			console.log( "the player closed" );
			console.log( "aka the session ended, we need to rescan for sessions and rejoin" );
			EventEmitter.emit( "player-closed" , tracking_object );
			return;
		});

	}
	catch( error ) { console.log( error ); return false; }
}

( async ()=> {
	await RedisConnect();
	EventEmitter = new events.EventEmitter();
	const tracking_objects = await BuildTrackingObjectsFromUUDIS();
	if ( !tracking_objects ) { REBOOT_DOCKER(); return; }
	for ( let i = 0; i < tracking_objects.length; ++i ) {
		one_hot_join_session_zero_and_listen_for_statuses( tracking_objects[ i ] );
		await sleep( 500 );
	}
	EventEmitter.on( "player-closed" , async ( tracking_object ) => {
		await sleep( 1000 );
		one_hot_join_session_zero_and_listen_for_statuses( tracking_object );
	});
})();