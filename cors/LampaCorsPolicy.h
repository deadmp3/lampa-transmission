#pragma once
#include <cstring>

// Exact origins only. Add your own Lampa host here before building.
inline bool lampaCorsOriginAllowed(char const* origin)
{
    if (origin == nullptr) return false;
    char const* const allowed[] = {
        "http://bylampa.online", "https://bylampa.online",
        "http://lampa.mx", "https://lampa.mx"
    };
    for (char const* item : allowed)
        if (std::strcmp(origin, item) == 0) return true;
    return false;
}
