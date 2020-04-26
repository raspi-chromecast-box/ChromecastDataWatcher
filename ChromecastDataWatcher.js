const process = require( "process" );
const path = require( "path" );
const exec = require( "child_process" ).exec;

// const global_package_path = process.argv[ 0 ].split( "/bin/node" )[ 0 ] + "/lib/node_modules";
// const castv2 = require( path.join( global_package_path ,  "castv2-client" ) );
// const events = require( path.join( global_package_path ,  "events" ) );
// const RMU = require( path.join( global_package_path , "redis-manager-utils" ) );

const castv2 = require(  "castv2-client" );
const events = require( "events" );
const RMU = require( "redis-manager-utils" );

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

function save_status_backdrop( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			// if ( !tracking_object ) { resolve(); return; }
			// const redis_key = `APPS.SPOTIFY.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;
			// const status = tracking_object.latest_status;
			// let db_object = {};
			// console.log( db_object );
			// db_object = JSON.stringify( db_object );
			// await RedisPushPopToCircularListLength100( redis_key , db_object );
			// await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); reject( error ); return; }
	});
}

function save_status_generic( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			if ( !tracking_object ) { resolve(); return; }
			const redis_key = `APPS.GENERIC.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;
			let db_object = { app: "generic" , ...tracking_object.latest_status };
			db_object = JSON.stringify( db_object );
			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); reject( error ); return; }
	});
}

function save_status_youtube( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			if ( !tracking_object ) { resolve(); return; }
			const redis_key = `APPS.YOUTUBE.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;

			// TODO
			// =================================
			// const status = tracking_object.latest_status;
			let db_object = { app: "youtube" , ...tracking_object.latest_status };
			// console.log( db_object );
			db_object = JSON.stringify( db_object );

			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); reject( error ); return; }
	});
}

function save_status_disney_plus( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			if ( !tracking_object ) { resolve(); return; }
			const redis_key = `APPS.DISNEY_PLUS.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;

			// TODO
			// =================================
			// const status = tracking_object.latest_status;
			let db_object = { app: "disney_plus" , ...tracking_object.latest_status };
			// console.log( db_object );
			db_object = JSON.stringify( db_object );


			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); reject( error ); return; }
	});
}

function save_status_spotify( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			if ( !tracking_object ) { resolve(); return; }
			const redis_key = `APPS.SPOTIFY.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;
			const status = tracking_object.latest_status;
			let db_object = { app: "spotify" };

			if ( !!status.statusText ) {
				db_object.status_text = status.statusText
			}
			if ( !!status.playbackRate ) {
				db_object.playback_rate = status.playbackRate
			}
			if ( !!status.playerState ) {
				db_object.player_state = status.playerState
			}
			if ( !!status.currentTime ) {
				db_object.current_time = status.currentTime;
			}
			if ( !!status.volume ) {
				if ( !!status.volume.level ) {
					db_object.volume = status.volume.level;
				}
				if ( status.volume.muted ) {
					db_object.muted = status.volume.muted;
				}
				else {
					db_object.muted = false;
				}
			}
			if ( !!status.media ) {
				if ( !!status.media.contentId ) {
					db_object.uri = status.media.contentId;
				}
				if ( !!status.media.streamType ) {
					db_object.stream_type = status.media.streamType;
				}
				if ( !!status.media.mediaCategory ) {
					db_object.media_category = status.media.mediaCategory;
				}
				if ( !!status.media.contentType ) {
					db_object.content_type = status.media.contentType;
				}
				if ( !!status.media.metadata ) {
					if ( !!status.media.metadata.title ) {
						db_object.title = status.media.metadata.title;
					}
					if ( !!status.media.metadata.songName ) {
						db_object.song_name = status.media.metadata.songName;
					}
					if ( !!status.media.metadata.artist ) {
						db_object.artist = status.media.metadata.artist;
					}
					if ( !!status.media.metadata.albumName ) {
						db_object.album_name = status.media.metadata.albumName;
					}
				}
				if ( !!status.media.duration ) {
					db_object.duration = status.media.duration;
				}
			}
			if ( !!status.repeatMode ) {
				db_object.repeat_mode = status.repeatMode;
			}
			if ( !!status.extendedStatus ) {
				if ( !!status.extendedStatus.playerState ) {
					db_object.player_state = status.extendedStatus.playerState;
				}
				if ( !!status.extendedStatus.media ) {
					if ( !!status.extendedStatus.media.contentId ) {
						db_object.uri = status.extendedStatus.media.contentId;
					}
					if ( !!status.extendedStatus.media.streamType ) {
						db_object.stream_type = status.extendedStatus.media.streamType;
					}
					if ( !!status.extendedStatus.media.mediaCategory ) {
						db_object.media_category = status.extendedStatus.media.mediaCategory;
					}
					if ( !!status.extendedStatus.media.contentType ) {
						db_object.content_type = status.extendedStatus.media.contentType;
					}
					if ( !!status.extendedStatus.media.duration ) {
						db_object.duration = status.extendedStatus.media.duration;
					}
					if ( !!status.extendedStatus.media.metadata ) {
						if ( !status.extendedStatus.media.metadata.title ) {
							db_object.title = status.extendedStatus.media.metadata.title;
						}
						if ( !!status.extendedStatus.media.metadata.songName ) {
							db_object.song_name = status.extendedStatus.media.metadata.songName;
						}
						if ( !!status.extendedStatus.media.metadata.artist ) {
							db_object.artist = status.extendedStatus.media.metadata.artist;
						}
						if ( !!status.extendedStatus.media.metadata.albumName ) {
							db_object.album_name = status.extendedStatus.media.metadata.albumName;
						}
					}
				}
			}
			console.log( db_object );
			db_object = JSON.stringify( db_object );
			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); reject( error ); return; }
	});
}

function save_status_twitch( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			if ( !tracking_object ) { resolve(); return; }
			const redis_key = `APPS.TWITCH.STATUSES.${ tracking_object[ "uuid_redis_key" ] }`;
			const status = tracking_object.latest_status;
			let db_object = { app: "twitch" };
			if ( !!status.statusText ) {
				db_object.status_text = status.statusText
			}
			if ( !!status.playbackRate ) {
				db_object.playback_rate = status.playbackRate
			}
			if ( !!status.playerState ) {
				db_object.player_state = status.playerState
			}
			if ( !!status.volume ) {
				if ( !!status.volume.level ) {
					db_object.volume = status.volume.level;
				}
				if ( status.volume.muted ) {
					db_object.muted = status.volume.muted;
				}
				else {
					db_object.muted = false;
				}
			}
			if ( !!status.media ) {
				if ( !!status.media.streamType ) {
					db_object.stream_type = status.media.streamType;
				}
				if ( !!status.media.contentUrl ) {
					db_object.m3u8_url = status.media.contentUrl;
				}
				else if ( !!status.media.contentId ) {
					db_object.m3u8_url = status.media.contentId;
				}
				if ( !!status.media.duration ) {
					db_object.duration = status.media.duration;
				}
				if ( !!status.media.metadata ) {
					if ( !!status.media.metadata.subtitle ) {
						db_object.stream_category = status.media.metadata.subtitle;
					}
				}
				if ( !!status.media.customData.analytics ) {
					if ( !!status.media.customData.analytics.chromecast_sender ) {
						db_object.chromecast_sender = status.media.customData.analytics.chromecast_sender;
					}
					if ( !!status.media.customData.analytics.login ) {
						db_object.logged_in_username = status.media.customData.analytics.login;
					}
					if ( !!status.media.customData.analytics.subscriber ) {
						db_object.logged_in_user_is_subscriber = status.media.customData.analytics.subscriber;
					}
					if ( !!status.media.customData.analytics.turbo ) {
						db_object.logged_in_user_is_turbo = status.media.customData.analytics.turbo;
					}
				}
			}
			if ( !!status.videoInfo ) {
				db_object.video_info = status.videoInfo;
			}
			if ( !!status.repeatMode ) {
				db_object.repeat_mode = status.repeatMode;
			}
			if ( !!status.currentTime ) {
				db_object.current_time = status.currentTime;
			}
			console.log( db_object );
			db_object = JSON.stringify( db_object );
			await RedisPushPopToCircularListLength100( redis_key , db_object );
			await redis_manager.redis.publish( "APPS-STATUSES" , db_object );
			resolve();
			return;
		}
		catch( error ) { console.log( error ); resolve( false ); return; }
	});
}

function save_status( tracking_object ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			switch( tracking_object[ "session" ][ "appId" ] ) {
				case "E8C28D3C":
					await save_status_backdrop( tracking_object );
					break;
				case "233637DE":
					await save_status_youtube( tracking_object );
					break;
				case "CC32E753":
					await save_status_spotify( tracking_object );
					break;
				case "C3DE6BC2":
					await save_status_disney_plus( tracking_object );
					break;
				case "B3DCF968":
					await save_status_twitch( tracking_object );
					break;
				default:
					console.log( `Unknown App ID: ${ tracking_object[ "session" ][ "appId" ] }` );
					console.log( `App Name == ${ tracking_object[ "session" ][ "displayName" ] }` );
					console.log( tracking_object.latest_status );
					await save_status_generic( tracking_object )
					break;
			}
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