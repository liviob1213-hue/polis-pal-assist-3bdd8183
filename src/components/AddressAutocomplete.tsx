import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  apiKey: string;
}

const AddressAutocomplete = ({ value, onChange, placeholder = "Digite o endereço...", apiKey }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  // Load Google Maps script if not yet loaded
  useEffect(() => {
    if (!apiKey) return;
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize autocomplete
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "br" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
      } else if (place?.name) {
        onChange(place.name);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [loaded, onChange]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={loaded ? placeholder : "Carregando autocomplete..."}
      className="bg-background"
    />
  );
};

export default AddressAutocomplete;
