"""
Google Calendar Service for scheduling integration
Handles calendar events, scheduling, and availability management
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleCalendarService:
    """Google Calendar API integration service"""
    
    # Required scopes for calendar operations
    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ]
    
    def __init__(self, credentials_file: str = None, token_file: str = None):
        """
        Initialize Google Calendar service
        
        Args:
            credentials_file: Path to Google OAuth2 credentials JSON file
            token_file: Path to store/retrieve user tokens
        """
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None
        self.credentials = None
        
    async def initialize_service(self, user_credentials: Dict = None) -> Dict[str, Any]:
        """
        Initialize the Google Calendar service with user credentials
        
        Args:
            user_credentials: User's OAuth2 credentials as dict
            
        Returns:
            Dict with initialization result
        """
        try:
            if user_credentials:
                # Use provided credentials
                self.credentials = Credentials.from_authorized_user_info(
                    user_credentials, self.SCOPES
                )
            elif self.token_file:
                # Try to load from token file
                try:
                    with open(self.token_file, 'r') as token:
                        creds_data = json.load(token)
                        self.credentials = Credentials.from_authorized_user_info(
                            creds_data, self.SCOPES
                        )
                except FileNotFoundError:
                    pass
            
            # Refresh credentials if needed
            if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                await asyncio.to_thread(self.credentials.refresh, Request())

            if self.credentials and self.credentials.valid:
                self.service = await asyncio.to_thread(
                    build, 'calendar', 'v3', credentials=self.credentials
                )
                return {
                    'success': True,
                    'message': 'Google Calendar service initialized successfully',
                    'has_credentials': True
                }
            else:
                return {
                    'success': False,
                    'message': 'Valid credentials required',
                    'has_credentials': False,
                    'auth_url': await self._get_auth_url() if self.credentials_file else None
                }
                
        except Exception as e:
            logger.error(f"Error initializing Google Calendar service: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'has_credentials': False
            }
    
    async def _get_auth_url(self) -> Optional[str]:
        """Get OAuth2 authorization URL"""
        try:
            if not self.credentials_file:
                return None
                
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=self.SCOPES,
                redirect_uri='urn:ietf:wg:oauth:2.0:oob'
            )
            
            auth_url, _ = flow.authorization_url(prompt='consent')
            return auth_url
            
        except Exception as e:
            logger.error(f"Error getting auth URL: {str(e)}")
            return None
    
    async def create_event(
        self,
        title: str,
        start_datetime: datetime,
        end_datetime: datetime,
        description: str = "",
        attendees: List[str] = None,
        location: str = "",
        calendar_id: str = 'primary',
        timezone: str = 'America/Sao_Paulo'
    ) -> Dict[str, Any]:
        """
        Create a calendar event
        
        Args:
            title: Event title
            start_datetime: Event start time
            end_datetime: Event end time
            description: Event description
            attendees: List of attendee emails
            location: Event location
            calendar_id: Calendar ID (default: 'primary')
            timezone: Timezone for the event
            
        Returns:
            Dict with event creation result
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Prepare attendees list
            attendee_list = []
            if attendees:
                attendee_list = [{'email': email} for email in attendees]
            
            # Create event object
            event = {
                'summary': title,
                'description': description,
                'location': location,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': timezone,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': timezone,
                },
                'attendees': attendee_list,
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 10},       # 10 minutes before
                    ],
                },
                'conferenceData': {
                    'createRequest': {
                        'requestId': f"sdk-agent-{datetime.now().timestamp()}",
                        'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                    }
                }
            }
            
            # Create the event in a thread to avoid blocking
            def _insert():
                return self.service.events().insert(
                    calendarId=calendar_id,
                    body=event,
                    conferenceDataVersion=1,
                    sendUpdates='all'
                ).execute()

            created_event = await asyncio.to_thread(_insert)
            
            return {
                'success': True,
                'event_id': created_event['id'],
                'event_url': created_event.get('htmlLink'),
                'hangout_link': created_event.get('conferenceData', {}).get('entryPoints', [{}])[0].get('uri'),
                'title': title,
                'start_time': start_datetime.isoformat(),
                'end_time': end_datetime.isoformat(),
                'attendees': attendees or [],
                'created_at': datetime.utcnow().isoformat()
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {str(e)}")
            return {
                'success': False,
                'error': f'Google Calendar API error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error creating calendar event: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_events(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        calendar_id: str = 'primary',
        max_results: int = 100
    ) -> Dict[str, Any]:
        """
        Get calendar events within date range
        
        Args:
            start_date: Start date for search (default: now)
            end_date: End date for search (default: now + 30 days)
            calendar_id: Calendar ID
            max_results: Maximum number of events to return
            
        Returns:
            Dict with events list
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Set default date range if not provided
            if not start_date:
                start_date = datetime.utcnow()
            if not end_date:
                end_date = start_date + timedelta(days=30)
            
            # Get events in a thread to avoid blocking
            def _list():
                return self.service.events().list(
                    calendarId=calendar_id,
                    timeMin=start_date.isoformat() + 'Z',
                    timeMax=end_date.isoformat() + 'Z',
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy='startTime'
                ).execute()

            events_result = await asyncio.to_thread(_list)
            
            events = events_result.get('items', [])
            
            # Format events
            formatted_events = []
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                end = event['end'].get('dateTime', event['end'].get('date'))
                
                formatted_events.append({
                    'id': event['id'],
                    'title': event.get('summary', 'No Title'),
                    'description': event.get('description', ''),
                    'start_time': start,
                    'end_time': end,
                    'location': event.get('location', ''),
                    'attendees': [att.get('email') for att in event.get('attendees', [])],
                    'event_url': event.get('htmlLink'),
                    'status': event.get('status')
                })
            
            return {
                'success': True,
                'events': formatted_events,
                'count': len(formatted_events),
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {str(e)}")
            return {
                'success': False,
                'error': f'Google Calendar API error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error getting calendar events: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def check_availability(
        self,
        start_datetime: datetime,
        end_datetime: datetime,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Check availability for a given time slot
        
        Args:
            start_datetime: Start time to check
            end_datetime: End time to check
            calendar_id: Calendar ID
            
        Returns:
            Dict with availability information
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Get events in the time range
            events_result = await self.get_events(
                start_date=start_datetime,
                end_date=end_datetime,
                calendar_id=calendar_id
            )
            
            if not events_result.get('success'):
                return events_result
            
            events = events_result.get('events', [])
            
            # Check for conflicts
            conflicts = []
            for event in events:
                event_start = datetime.fromisoformat(event['start_time'].replace('Z', '+00:00'))
                event_end = datetime.fromisoformat(event['end_time'].replace('Z', '+00:00'))
                
                # Check if events overlap
                if (start_datetime < event_end and end_datetime > event_start):
                    conflicts.append({
                        'event_id': event['id'],
                        'title': event['title'],
                        'start_time': event['start_time'],
                        'end_time': event['end_time']
                    })
            
            return {
                'success': True,
                'available': len(conflicts) == 0,
                'conflicts': conflicts,
                'requested_time': {
                    'start': start_datetime.isoformat(),
                    'end': end_datetime.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error checking availability: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def update_event(
        self,
        event_id: str,
        title: str = None,
        start_datetime: datetime = None,
        end_datetime: datetime = None,
        description: str = None,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Update an existing calendar event
        
        Args:
            event_id: Event ID to update
            title: New event title
            start_datetime: New start time
            end_datetime: New end time
            description: New description
            calendar_id: Calendar ID
            
        Returns:
            Dict with update result
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Get existing event in a thread
            def _get():
                return self.service.events().get(
                    calendarId=calendar_id,
                    eventId=event_id
                ).execute()

            event = await asyncio.to_thread(_get)
            
            # Update fields if provided
            if title:
                event['summary'] = title
            if description is not None:
                event['description'] = description
            if start_datetime:
                event['start'] = {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': 'America/Sao_Paulo',
                }
            if end_datetime:
                event['end'] = {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': 'America/Sao_Paulo',
                }
            
            # Update the event in a thread
            def _update():
                return self.service.events().update(
                    calendarId=calendar_id,
                    eventId=event_id,
                    body=event,
                    sendUpdates='all'
                ).execute()

            updated_event = await asyncio.to_thread(_update)
            
            return {
                'success': True,
                'event_id': updated_event['id'],
                'event_url': updated_event.get('htmlLink'),
                'updated_at': datetime.utcnow().isoformat()
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {str(e)}")
            return {
                'success': False,
                'error': f'Google Calendar API error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error updating calendar event: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def delete_event(
        self,
        event_id: str,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Delete a calendar event
        
        Args:
            event_id: Event ID to delete
            calendar_id: Calendar ID
            
        Returns:
            Dict with deletion result
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Delete the event in a thread
            def _delete():
                self.service.events().delete(
                    calendarId=calendar_id,
                    eventId=event_id,
                    sendUpdates='all'
                ).execute()

            await asyncio.to_thread(_delete)
            
            return {
                'success': True,
                'message': 'Event deleted successfully',
                'event_id': event_id,
                'deleted_at': datetime.utcnow().isoformat()
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {str(e)}")
            return {
                'success': False,
                'error': f'Google Calendar API error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error deleting calendar event: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def find_available_slots(
        self,
        date: datetime,
        duration_minutes: int = 60,
        working_hours: Dict[str, str] = None,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Find available time slots for a given date
        
        Args:
            date: Date to find available slots
            duration_minutes: Duration of each slot in minutes
            working_hours: Dict with 'start' and 'end' times (e.g., {'start': '09:00', 'end': '17:00'})
            calendar_id: Calendar ID
            
        Returns:
            Dict with available slots
        """
        try:
            if not self.service:
                return {
                    'success': False,
                    'error': 'Google Calendar service not initialized'
                }
            
            # Set default working hours
            if not working_hours:
                working_hours = {'start': '09:00', 'end': '17:00'}
            
            # Create start and end datetime for the day
            start_time = datetime.combine(date.date(), 
                                        datetime.strptime(working_hours['start'], '%H:%M').time())
            end_time = datetime.combine(date.date(), 
                                      datetime.strptime(working_hours['end'], '%H:%M').time())
            
            # Get existing events for the day
            events_result = await self.get_events(
                start_date=start_time,
                end_date=end_time,
                calendar_id=calendar_id
            )
            
            if not events_result.get('success'):
                return events_result
            
            events = events_result.get('events', [])
            
            # Create list of busy periods
            busy_periods = []
            for event in events:
                event_start = datetime.fromisoformat(event['start_time'].replace('Z', '+00:00'))
                event_end = datetime.fromisoformat(event['end_time'].replace('Z', '+00:00'))
                busy_periods.append((event_start, event_end))
            
            # Sort busy periods by start time
            busy_periods.sort()
            
            # Find available slots
            available_slots = []
            current_time = start_time
            slot_duration = timedelta(minutes=duration_minutes)
            
            for busy_start, busy_end in busy_periods:
                # Check if there's space before this busy period
                while current_time + slot_duration <= busy_start:
                    available_slots.append({
                        'start_time': current_time.isoformat(),
                        'end_time': (current_time + slot_duration).isoformat(),
                        'duration_minutes': duration_minutes
                    })
                    current_time += slot_duration
                
                # Move current time to after this busy period
                current_time = max(current_time, busy_end)
            
            # Check remaining time after last busy period
            while current_time + slot_duration <= end_time:
                available_slots.append({
                    'start_time': current_time.isoformat(),
                    'end_time': (current_time + slot_duration).isoformat(),
                    'duration_minutes': duration_minutes
                })
                current_time += slot_duration
            
            return {
                'success': True,
                'date': date.date().isoformat(),
                'available_slots': available_slots,
                'total_slots': len(available_slots),
                'working_hours': working_hours,
                'duration_minutes': duration_minutes
            }
            
        except Exception as e:
            logger.error(f"Error finding available slots: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
