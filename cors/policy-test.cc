#include "LampaCorsPolicy.h"
#include <cassert>
int main()
{
    assert(lampaCorsOriginAllowed("http://bylampa.online"));
    assert(lampaCorsOriginAllowed("https://bylampa.online"));
    assert(lampaCorsOriginAllowed("http://lampa.mx"));
    assert(!lampaCorsOriginAllowed(nullptr));
    assert(!lampaCorsOriginAllowed("null"));
    assert(!lampaCorsOriginAllowed("http://bylampa.online.evil.example"));
    assert(!lampaCorsOriginAllowed("https://evil.example"));
}
