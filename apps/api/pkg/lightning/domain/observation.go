// Package domain defines provider-independent lightning observations.
package domain

import "time"

type Mode string

const (
	Demo Mode = "demo"
	Live Mode = "live"
)

type Position struct {
	Latitude  float64
	Longitude float64
}

type Observation struct {
	ID         string
	Position   Position
	OccurredAt time.Time
}

type Batch struct {
	Mode         Mode
	Observations []Observation
}
