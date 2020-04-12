import sys
import os
import time
import json
from uuid import UUID
from pathlib import Path
import redis
import pychromecast

def try_to_connect_to_redis():
	try:
		redis_connection = redis.StrictRedis(
			host="127.0.0.1" ,
			port="6379" ,
			db=1 ,
			#password=ConfigDataBase.self[ 'redis' ][ 'password' ]
			)
		return redis_connection
	except Exception as e:
		return False

def RedisGetAllUUIDIS( redis_connection ):
	try:
		uuids = []
		# https://stackoverflow.com/a/34166690
		for key in redis_connection.scan_iter( "UUIDS.*" ):
			uuid = redis_connection.get( key )
			uuid = json.loads( uuid )
			uuids.append( uuid )
			return uuids
	except Exception as e:
		print( e )
		return False

class StatusListener:
	def __init__( self , name , cast , uuid , redis_connection ):
		self.name = name
		self.cast = cast
		self.uuid = uuid
		self.redis_connection = redis_connection
	def new_cast_status( self , status ):
		print( '[' , time.ctime() , ' - ' , self.name , '] status chromecast change:' )
		#print( status )
		try:
			key = "STATUS.UUIDS." + self.uuid
			db_object = {
				"uuid": self.uuid ,
				"name": self.name ,
				"status": {
					"is_active_input": status.is_active_input ,
					"is_stand_by": status.is_stand_by ,
					"volume_level": status.volume_level ,
					"volume_muted": status.volume_muted ,
					"app_id": status.app_id ,
					"display_name": status.display_name ,
					"namespaces": status.namespaces ,
					"session_id": status.session_id ,
					"transport_id": status.transport_id ,
					"status_text": status.status_text ,
					"icon_url": status.icon_url ,
				}
			}
			print( db_object )
			db_object = json.dumps( db_object )
			self.redis_connection.set( key , db_object )
			self.redis_connection.publish( "STATUS" , db_object )
		except Exception as e:
			print( "Couldn't Publish to Redis Channel" )
			print( e )

class StatusMediaListener:
	def __init__( self , name , cast , uuid , redis_connection ):
		self.name = name
		self.cast = cast
		self.uuid = uuid
		self.redis_connection = redis_connection
	def new_media_status( self , status ):
		print( '[' , time.ctime() , ' - ' , self.name , '] status media change:' )
		#print( status )
		try:
			key = "STATUS.MEDIA.UUIDS." + self.uuid
			db_object = {
				"uuid": self.uuid ,
				"name": self.name ,
				"media_status": {
					"metadata_type": status.metadata_type ,
					"title": status.title ,
					"series_title": status.series_title ,
					"season": status.season ,
					"episode": status.episode ,
					"artist": status.artist ,
					"album_name": status.album_name ,
					"album_artist": status.album_artist ,
					"track": status.track ,
					"subtitle_tracks": status.subtitle_tracks ,
					"images": status.images ,
					"supports_pause": status.supports_pause ,
					"supports_seek": status.supports_seek ,
					"supports_stream_volume": status.supports_stream_volume ,
					"supports_stream_mute": status.supports_stream_mute ,
					"supports_skip_forward": status.supports_skip_forward ,
					"supports_skip_backward": status.supports_skip_backward ,
					"current_time": status.current_time ,
					"duration": status.duration ,
					"stream_type": status.stream_type ,
					"idle_reason": status.idle_reason ,
					"media_session_id": status.media_session_id ,
					"playback_rate": status.playback_rate ,
					"player_state": status.player_state ,
					"supported_media_commands": status.supported_media_commands ,
					"volume_level": status.volume_level ,
					"volume_muted": status.volume_muted ,
					"media_custom_data": status.media_custom_data ,
					"media_metadata": {
						"metadataType": status.media_metadata[ 'metadataType' ] ,
						"title": status.media_metadata[ 'title' ] ,
						"subtitle": status.media_metadata[ 'subtitle' ] ,
						"images": status.media_metadata[ 'images' ] ,
					} ,
					"current_subtitle_tracks": status.current_subtitle_tracks ,
					"last_updated": str( status.last_updated )
				}
			}
			db_object = json.dumps( db_object )
			self.redis_connection.set( key , db_object )
			self.redis_connection.publish( "STATUS-MEDIA" , db_object )
		except Exception as e:
			print( "Couldn't Publish to Redis Channel" )
			print( e )

def setup_cast_listeners():
	try:
		redis_connection = try_to_connect_to_redis()
		if redis_connection is False:
			print( "Could not Connect to Redis DB" )
			return False
		uuids = RedisGetAllUUIDIS( redis_connection )
		print( "Found all these UUIDS in Redis DB" )
		print( uuids )
		if uuids is False:
			print( "Could Not Find any UUIDS in Redis DB" )
			return False
		for index , uuid in enumerate( uuids ):
			cast_device = pychromecast.Chromecast( uuid[ "ip" ] )
			cast_device.start()
			cast_listener = StatusListener( cast_device.name , cast_device , uuid[ "uuid" ] , redis_connection )
			cast_device.register_status_listener( cast_listener )
			cast_media_listener = StatusMediaListener( cast_device.name , cast_device , uuid[ "uuid" ] , redis_connection )
			cast_device.media_controller.register_status_listener( cast_media_listener )
			time.sleep( 1 )
		return True
	except Exception as e:
		print( e )
		return False

def try_run_block( options ):
	for i in range( options[ 'number_of_tries' ] ):
		attempt = options[ 'function_reference' ]()
		if attempt is not False:
			return attempt
		print( f"Couldn't Run '{ options[ 'task_name' ] }', Sleeping for { str( options[ 'sleep_inbetween_seconds' ] ) } Seconds" )
		time.sleep( options[ 'sleep_inbetween_seconds' ] )
	if options[ 'reboot_on_failure' ] == True:
		os.system( "reboot -f" )

try_run_block({
		"task_name": "Chromecast Listen Task" ,
		"number_of_tries": 5 ,
		"sleep_inbetween_seconds": 5 ,
		"function_reference": setup_cast_listeners ,
		"reboot_on_failure": True
	})
input( 'Listening for Chromecast events' )