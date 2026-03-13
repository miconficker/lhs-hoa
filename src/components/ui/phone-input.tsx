import { useState, useEffect, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountryCode {
  code: string;
  dial: string;
  flag: string;
}

const countryCodes: CountryCode[] = [
  { code: "PH", dial: "+63", flag: "🇵🇭" },
  { code: "US", dial: "+1", flag: "🇺🇸" },
  { code: "GB", dial: "+44", flag: "🇬🇧" },
  { code: "CA", dial: "+1", flag: "🇨🇦" },
  { code: "AU", dial: "+61", flag: "🇦🇺" },
  { code: "JP", dial: "+81", flag: "🇯🇵" },
  { code: "SG", dial: "+65", flag: "🇸🇬" },
  { code: "AE", dial: "+971", flag: "🇦🇪" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "912 345 6789",
      required = false,
      id,
      className,
    },
    ref,
  ) => {
    const [countryCode, setCountryCode] = useState("+63");
    const [localNumber, setLocalNumber] = useState("");

    // Parse initial value to get country code and local number
    useEffect(() => {
      if (value) {
        const codes = countryCodes.map((c) => c.dial);
        const foundCode = codes.find((code) => value.startsWith(code));
        if (foundCode) {
          setCountryCode(foundCode);
          setLocalNumber(value.slice(foundCode.length).trim());
        } else {
          setLocalNumber(value);
        }
      }
    }, [value]);

    const handleLocalNumberChange = (
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      let inputValue = e.target.value.replace(/\D/g, ""); // Remove non-digits

      // Limit to 10 digits for PH numbers
      if (countryCode === "+63") {
        inputValue = inputValue.slice(0, 10);
      }

      // Auto-format as XXX XXX XXX or XXXX XXX for PH
      if (countryCode === "+63" && inputValue.length <= 10) {
        if (inputValue.length >= 7) {
          inputValue = `${inputValue.slice(0, 3)} ${inputValue.slice(3, 6)} ${inputValue.slice(6, 10)}`;
        } else if (inputValue.length >= 4) {
          inputValue = `${inputValue.slice(0, 3)} ${inputValue.slice(3)}`;
        }
      }

      setLocalNumber(inputValue);
      onChange(`${countryCode} ${inputValue}`);
    };

    const handleCountryCodeChange = (newDial: string) => {
      setCountryCode(newDial);
      if (localNumber) {
        onChange(`${newDial} ${localNumber}`);
      }
    };

    return (
      <div className={className}>
        {label && (
          <Label htmlFor={id || "phone"} className="mb-2 block">
            Phone Number{" "}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <div className="flex gap-2">
          <Select value={countryCode} onValueChange={handleCountryCodeChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countryCodes.map((country) => (
                <SelectItem key={country.code} value={country.dial}>
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span className="text-xs text-muted-foreground">
                      {country.code}
                    </span>
                    <span>{country.dial}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            ref={ref}
            id={id || "phone"}
            type="tel"
            value={localNumber}
            onChange={handleLocalNumberChange}
            placeholder={placeholder}
            required={required}
            className="flex-1"
            maxLength={15} // Limit input length
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          We'll use this to send updates about your booking
        </p>
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";
