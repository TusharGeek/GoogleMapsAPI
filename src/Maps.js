import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Polyline, useJsApiLoader } from '@react-google-maps/api';

const containerStyle = {
  width: '50vw',
  height: '50vh'
};

const defaultCenter = { lat: 34.0522, lng: -118.2437 };

function Maps() {
  const [location, setLocation] = useState(() => {
    const savedLocation = localStorage.getItem('location');
    return savedLocation ? JSON.parse(savedLocation) : defaultCenter;
  });

  const [destination, setDestination] = useState(() => {
    const savedDestination = localStorage.getItem('destination');
    return savedDestination ? JSON.parse(savedDestination) : null;
  });

  const [directions, setDirections] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [clickedCoordinates, setClickedCoordinates] = useState(null);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [steps, setSteps] = useState([]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: "API Key here" // Ensure you have this key in your environment variables
  });

  const directionsServiceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('location', JSON.stringify(location));
  }, [location]);

  useEffect(() => {
    localStorage.setItem('destination', JSON.stringify(destination));
  }, [destination]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(newLocation);
        },
        (error) => {
          console.error("Error getting initial location: ", error);
        },
        { enableHighAccuracy: true }
      );

      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(newLocation);
        },
        (error) => {
          console.error("Error watching location: ", error);
        },
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    if (isLoaded && location && destination) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsServiceRef.current = directionsService;

      const fetchDirections = () => {
        directionsService.route({
          origin: location,
          destination: destination,
          travelMode: window.google.maps.TravelMode.WALKING
        }, (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
            if (result.routes[0] && result.routes[0].legs[0]) {
              const leg = result.routes[0].legs[0];
              setDuration(leg.duration.text);
              setDistance(leg.distance.text);
              setSteps(leg.steps);
              setRoutePolyline(generatePolyline(result.routes[0].overview_path)); // Generate polyline for arrows
            }
          } else {
            console.error(`Error fetching directions: ${result}`);
          }
        });
      };

      fetchDirections();
      const intervalId = setInterval(fetchDirections, 30000);
      return () => clearInterval(intervalId);
    } else {
      setDirections(null);
    }
  }, [isLoaded, location, destination]);

  function handleMapClick(event) {
    const newDestination = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    setDestination(newDestination);
    setClickedCoordinates(newDestination);
  }

  function handleGeocode() {
    if (isLoaded && destinationInput) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: destinationInput }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const newDestination = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          };
          setDestination(newDestination);
          setClickedCoordinates(null);
        } else {
          console.error('Geocode was not successful for the following reason: ' + status);
        }
      });
    } else {
      console.error('Google Maps API is not yet loaded or destination input is empty.');
    }
  }

  function generatePolyline(path) {
    return path.map((point, index) => {
      if (index < path.length - 1) {
        return {
          lat: point.lat(),
          lng: point.lng()
        };
      }
      return null;
    }).filter(point => point !== null);
  }

  function renderArrowSymbols() {
    if (!routePolyline) return [];

    return routePolyline.map((point, index) => ({
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      offset: `${(index / routePolyline.length) * 100}%`,
      scale: 3,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2
    }));
  }

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  const currentLocationIcon = {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: "#4285F4",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "white"
  };

  return (
    <div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={location}
        zoom={15}
        onClick={handleMapClick}
      >
        {directions && <DirectionsRenderer directions={directions} />}
        <Marker position={location} icon={currentLocationIcon} />
        {destination && <Marker position={destination} />}
        {routePolyline && (
          <Polyline
            path={routePolyline}
            options={{
              strokeColor: '#FF0000',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              icons: renderArrowSymbols()
            }}
          />
        )}
      </GoogleMap>
      <div style={{
        marginTop: '10px',
        padding: '10px',
        background: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '4px',
        width: '50vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <input
          value={destinationInput}
          onChange={e => setDestinationInput(e.target.value)}
          placeholder="Enter destination address"
          style={{ padding: '10px', width: '300px', marginBottom: '10px' }}
        />
        <div>
          <button onClick={handleGeocode} disabled={!isLoaded} style={{ marginRight: '10px' }}>Set Destination by Address</button>
          <button onClick={() => {
            setDestination(null);
            setDirections(null);
            setClickedCoordinates(null);
            setDuration('');
            setDistance('');
            setSteps([]);
            setRoutePolyline(null);
          }}>Clear Destination</button>
        </div>
        {clickedCoordinates && (
          <div style={{ marginTop: '10px' }}>
            <p>Clicked Coordinates:</p>
            <p>Lat: {clickedCoordinates.lat}, Lng: {clickedCoordinates.lng}</p>
          </div>
        )}
        {duration && (
          <div style={{ marginTop: '10px' }}>
            <p>Estimated Time of Arrival (ETA): {duration}</p>
          </div>
        )}
        {distance && (
          <div style={{ marginTop: '10px' }}>
            <p>Distance: {distance}</p>
          </div>
        )}
        {steps.length > 0 && (
          <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'scroll', width: '100%' }}>
            <h3>Steps:</h3>
            <ol>
              {steps.map((step, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: step.instructions }} />
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default Maps;
